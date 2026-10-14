// objcap: Apple Object Capture (RealityKit PhotogrammetrySession) on a folder of photos.
//
//   objcap <photo folder> <out dir> [--detail=reduced|medium|full|raw|preview] [--masking=on|off]
//          [--sensitivity=normal|high] [--ordering=unordered|sequential]
//
// Writes <out>/model.usdz, <out>/obj/ (baked-texture OBJ + MTL + PNG maps, the same model), <out>/poses.json
// (one entry per registered photo: file name and the 4x4 camera-to-model transform, column-major; macOS 14+),
// <out>/report.json (status, wall-clock seconds, registered/total photos, the error text on failure) and
// progress on stdout. The model frame is Object Capture's own (arbitrary origin, scale and orientation):
// objcap_post.py aligns it to the statue with the poses.
import Foundation
import RealityKit

setvbuf(stdout, nil, _IOLBF, 0)
let argv = CommandLine.arguments
func opt(_ k: String, _ d: String) -> String {
    argv.first { $0.hasPrefix("--\(k)=") }.map { String($0.dropFirst(k.count + 3)) } ?? d
}
let positional = argv.dropFirst().filter { !$0.hasPrefix("--") }
guard positional.count == 2 else {
    print("usage: objcap <photo folder> <out dir> [--detail=reduced|medium|full|raw|preview] [--masking=on|off] [--sensitivity=normal|high] [--ordering=unordered|sequential]")
    exit(2)
}
let input = URL(fileURLWithPath: positional[positional.startIndex], isDirectory: true)
let out = URL(fileURLWithPath: positional[positional.startIndex + 1], isDirectory: true)
try FileManager.default.createDirectory(at: out.appendingPathComponent("obj"), withIntermediateDirectories: true)

let detailName = opt("detail", "reduced")
let detail: PhotogrammetrySession.Request.Detail
switch detailName {
case "preview": detail = .preview
case "reduced": detail = .reduced
case "medium": detail = .medium
case "full": detail = .full
case "raw": detail = .raw
default: print("unknown --detail \(detailName)"); exit(2)
}
var config = PhotogrammetrySession.Configuration()
config.isObjectMaskingEnabled = opt("masking", "on") == "on"
config.featureSensitivity = opt("sensitivity", "high") == "high" ? .high : .normal
config.sampleOrdering = opt("ordering", "unordered") == "sequential" ? .sequential : .unordered

let photos = ((try? FileManager.default.contentsOfDirectory(atPath: input.path)) ?? [])
    .filter { ["jpg", "jpeg", "png", "heic", "tif", "tiff"].contains(($0 as NSString).pathExtension.lowercased()) }
print("objcap: \(photos.count) photos in \(input.path), detail=\(detailName), masking=\(config.isObjectMaskingEnabled), sensitivity=\(opt("sensitivity", "high")), supported=\(PhotogrammetrySession.isSupported)")

let start = Date()
var report: [String: Any] = [
    "input": input.path, "photos": photos.count, "detail": detailName,
    "masking": config.isObjectMaskingEnabled, "sensitivity": opt("sensitivity", "high"),
    "supported": PhotogrammetrySession.isSupported,
]
func writeReport(_ status: String) {
    report["status"] = status
    report["seconds"] = (Date().timeIntervalSince(start) * 10).rounded() / 10
    if let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]) {
        try? data.write(to: out.appendingPathComponent("report.json"))
    }
}

let session: PhotogrammetrySession
do {
    session = try PhotogrammetrySession(input: input, configuration: config)
} catch {
    report["error"] = "\(error)"
    writeReport("session-failed")
    print("objcap: session failed: \(error)")
    exit(1)
}

var failures: [String] = []
var invalid: [String] = []
let done = DispatchSemaphore(value: 0)
Task {
    do {
        for try await output in session.outputs {
            switch output {
            case .requestProgress(_, let fraction):
                print(String(format: "progress %.3f  %.0fs", fraction, Date().timeIntervalSince(start)))
            case .requestComplete(let request, let result):
                switch result {
                case .poses(let poses):
                    var rows: [[String: Any]] = []
                    var names: [Int: String] = [:]
                    for (i, url) in poses.urlsBySample { names[i] = url.lastPathComponent }
                    for (i, pose) in poses.posesBySample {
                        let m = pose.transform.matrix
                        let cols = [m.columns.0, m.columns.1, m.columns.2, m.columns.3]
                        rows.append(["sample": i, "file": names[i] ?? "", "matrix": cols.flatMap { [$0.x, $0.y, $0.z, $0.w] }])
                    }
                    report["registered"] = rows.count
                    let data = try JSONSerialization.data(withJSONObject: ["poses": rows.sorted { ($0["file"] as! String) < ($1["file"] as! String) }], options: [.prettyPrinted])
                    try data.write(to: out.appendingPathComponent("poses.json"))
                    print("objcap: poses for \(rows.count) of \(photos.count) photos")
                case .modelFile(let url):
                    print("objcap: wrote \(url.path)")
                default:
                    print("objcap: request complete \(request)")
                }
            case .requestError(let request, let error):
                failures.append("\(request): \(error)")
                print("objcap: request error \(request): \(error)")
            case .invalidSample(let id, let reason):
                invalid.append("\(id): \(reason)")
            case .skippedSample(let id):
                invalid.append("\(id): skipped")
            case .processingComplete:
                done.signal()
                return
            case .processingCancelled:
                failures.append("cancelled")
                done.signal()
                return
            default:
                break
            }
        }
    } catch {
        failures.append("outputs: \(error)")
        done.signal()
    }
}

do {
    // .raw is refused (processError) when a .usdz file is requested too; write only the OBJ folder for it.
    var requests: [PhotogrammetrySession.Request] = [.poses, .modelFile(url: out.appendingPathComponent("obj", isDirectory: true), detail: detail)]
    if detailName != "raw" { requests.append(.modelFile(url: out.appendingPathComponent("model.usdz"), detail: detail)) }
    try session.process(requests: requests)
} catch {
    report["error"] = "\(error)"
    writeReport("process-failed")
    print("objcap: process failed: \(error)")
    exit(1)
}
done.wait()
report["invalidSamples"] = invalid
if !failures.isEmpty { report["error"] = failures.joined(separator: "\n") }
writeReport(failures.isEmpty ? "ok" : "failed")
print("objcap: \(failures.isEmpty ? "ok" : "failed") in \(Int(Date().timeIntervalSince(start))) s")
exit(failures.isEmpty ? 0 : 1)

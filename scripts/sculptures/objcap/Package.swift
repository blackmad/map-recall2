// swift-tools-version:5.9
// Apple Object Capture (RealityKit PhotogrammetrySession) as a command-line tool for the sculpture prototype.
// Build: swift build -c release --package-path scripts/sculptures/objcap   (binary: .build/release/objcap)
import PackageDescription

let package = Package(
    name: "objcap",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(name: "objcap", path: "Sources/objcap")
    ]
)

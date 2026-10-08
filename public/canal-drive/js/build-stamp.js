// Shows which revision this build is, from the `deployment.json` the Firebase
// deploy workflow writes to each site root ({ sha, short, run, builtAt }).
// It is the fastest way to tell whether a browser is running the newest
// deploy, which matters because every asset here is hand-cache-busted.
//
// A fixed badge, not a line in the OSM/CARTO credit: that credit sits at the
// bottom-left, which the route-setup card covers until the ride starts — so a
// stamp there is invisible exactly when someone is looking at the landing.
//
// Local dev has no deployment.json, so this fails silently and shows nothing.
(function () {
  function render(info) {
    if (!info || !info.sha) return;
    window.CanalRecallBuild = info;
    var sha = info.short || String(info.sha).slice(0, 7);
    var built = info.builtAt ? new Date(info.builtAt) : null;
    var date = built && !isNaN(built.getTime()) ? built.toISOString().slice(0, 10) : '';

    var el = document.getElementById('build-stamp');
    if (!el) {
      el = document.createElement('div');
      el.id = 'build-stamp';
      // Above the ride's bottom bar and clear of the setup card; ignored by
      // pointer input so it can never eat a tap.
      el.style.cssText = [
        'position:fixed',
        'right:calc(8px + env(safe-area-inset-right))',
        'bottom:calc(34px + env(safe-area-inset-bottom))',
        'z-index:32',
        'font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace',
        'color:#303b43',
        'background:rgba(247,244,236,.78)',
        'border-radius:6px',
        'padding:2px 6px',
        'pointer-events:none',
        'white-space:nowrap',
      ].join(';');
      (document.getElementById('utility-buttons') || document.body).appendChild(el);
    }
    el.textContent = 'build ' + sha + (date ? ' \u00b7 ' + date : '');
    el.title = 'Revision ' + info.sha + (info.builtAt ? '\nBuilt ' + info.builtAt : '')
      + (info.run ? '\nDeploy run ' + info.run : '');
  }

  try {
    fetch('deployment.json', { cache: 'no-store' })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(render)
      .catch(function () { /* local dev, or offline: no stamp */ });
  } catch (error) { /* no fetch: no stamp */ }
})();

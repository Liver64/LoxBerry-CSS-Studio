(function () {
  'use strict';

  function selectBackground(previewRoot) {
    previewRoot.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  }

  function scrollToWallpaper(wallpaperControls) {
    if (!wallpaperControls || wallpaperControls.hidden) return;
    wallpaperControls.scrollIntoView({ behavior: 'smooth', block: 'center' });
    wallpaperControls.classList.add('cfw-direct-focus');
    window.setTimeout(function () {
      wallpaperControls.classList.remove('cfw-direct-focus');
    }, 1600);
  }

  function init() {
    var previewRoot = document.getElementById('previewRoot');
    var shortcut = document.getElementById('previewWallpaperShortcut');
    var wallpaperControls = document.getElementById('wallpaperControls');
    if (!previewRoot || !shortcut || !wallpaperControls) return;

    shortcut.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();

      previewRoot.classList.add('cfw-wallpaper-shortcut-active');
      selectBackground(previewRoot);

      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          scrollToWallpaper(wallpaperControls);
          window.setTimeout(function () {
            previewRoot.classList.remove('cfw-wallpaper-shortcut-active');
          }, 1600);
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll('[data-workspace-tab]');
  const panels = document.querySelectorAll('[data-workspace-panel]');

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const selectedTab = button.dataset.workspaceTab;
      tabButtons.forEach((tab) => {
        const isSelected = tab === button;
        tab.classList.toggle('is-active', isSelected);
        tab.setAttribute('aria-selected', String(isSelected));
      });
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.workspacePanel !== selectedTab;
      });
    });
  });

  const uploadInput = document.getElementById('video-upload');
  const videoLibrary = document.getElementById('video-library');
  let previewUrls = [];

  uploadInput.addEventListener('change', () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];
    videoLibrary.replaceChildren();

    const files = Array.from(uploadInput.files || []).filter((file) => file.type.startsWith('video/'));
    if (!files.length) {
      const emptyState = document.createElement('p');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'Selecciona uno o más archivos de video para verlos aquí.';
      videoLibrary.append(emptyState);
      return;
    }

    files.forEach((file) => {
      const card = document.createElement('article');
      card.className = 'video-card';

      const video = document.createElement('video');
      video.controls = true;
      video.preload = 'metadata';
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      video.src = url;

      const title = document.createElement('p');
      title.textContent = file.name;
      card.append(video, title);
      videoLibrary.append(card);
    });
  });

  window.addEventListener('pagehide', () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
  });
});

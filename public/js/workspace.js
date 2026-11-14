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
});

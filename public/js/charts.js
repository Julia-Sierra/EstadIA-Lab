window.ESTADIA = window.ESTADIA || {};

window.ESTADIA.createComparisonChart = (canvas, labels, values) => {
  if (!canvas) return;
  if (window.ESTADIA.chartInstance) {
    window.ESTADIA.chartInstance.destroy();
  }

  window.ESTADIA.chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Probabilidad',
        data: values,
        backgroundColor: ['#8ca5ff', '#7ad9b5', '#ffc5d9', '#ffd9a8'],
        borderRadius: 10
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: (value) => `${value * 100}%`
          }
        }
      }
    }
  });
};

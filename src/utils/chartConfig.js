import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components once for the entire application
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Global styling defaults matching Star weAR theme
ChartJS.defaults.color = '#94a3b8';
ChartJS.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/**
 * Currency formatter
 */
export const formatCurrency = (val, maxDecimals = 0) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: maxDecimals,
    maximumFractionDigits: maxDecimals
  }).format(val || 0);
};

/**
 * Helper to generate smooth canvas gradient fills
 */
export const createGradient = (ctx, startColor, stopColor = 'rgba(0, 0, 0, 0)') => {
  if (!ctx || !ctx.canvas) return startColor;
  const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height || 300);
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(1, stopColor);
  return gradient;
};

/**
 * Common tooltip styling for glassmorphic dark theme
 */
export const glassTooltipStyle = {
  backgroundColor: 'rgba(11, 15, 25, 0.95)',
  borderColor: 'rgba(255, 255, 255, 0.12)',
  borderWidth: 1,
  padding: 12,
  boxPadding: 6,
  usePointStyle: true,
  cornerRadius: 8,
  titleFont: {
    size: 13,
    weight: '600',
    family: "'Inter', sans-serif"
  },
  bodyFont: {
    size: 12,
    family: "'Inter', sans-serif"
  },
  footerFont: {
    size: 11,
    style: 'italic'
  }
};

/**
 * Standard Dark Line / Area Chart Options
 */
export const getLineChartOptions = (isCurrency = true, customYFormatter = null) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false
  },
  plugins: {
    legend: {
      display: true,
      position: 'top',
      align: 'end',
      labels: {
        color: '#e2e8f0',
        usePointStyle: true,
        boxWidth: 8,
        boxHeight: 8,
        padding: 16,
        font: {
          size: 12,
          weight: '500'
        }
      }
    },
    tooltip: {
      ...glassTooltipStyle,
      callbacks: {
        label: (context) => {
          const val = context.parsed.y;
          const label = context.dataset.label || '';
          if (isCurrency) {
            return ` ${label}: ${formatCurrency(val, 2)}`;
          }
          return ` ${label}: ${val.toLocaleString()}`;
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(255, 255, 255, 0.04)',
        tickColor: 'transparent'
      },
      ticks: {
        color: '#94a3b8',
        font: { size: 11 },
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 10
      },
      border: {
        display: false
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(255, 255, 255, 0.06)',
        tickColor: 'transparent'
      },
      ticks: {
        color: '#94a3b8',
        font: { size: 11 },
        padding: 8,
        callback: (val) => {
          if (customYFormatter) return customYFormatter(val);
          if (isCurrency) {
            if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
            if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
            return `$${val}`;
          }
          if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
          return val;
        }
      },
      border: {
        display: false
      }
    }
  }
});

/**
 * Standard Dark Bar Chart Options
 */
export const getBarChartOptions = (isCurrency = true, horizontal = false) => ({
  indexAxis: horizontal ? 'y' : 'x',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      ...glassTooltipStyle,
      callbacks: {
        label: (context) => {
          const val = horizontal ? context.parsed.x : context.parsed.y;
          const label = context.dataset.label || 'Value';
          return isCurrency ? ` ${label}: ${formatCurrency(val, 2)}` : ` ${label}: ${val.toLocaleString()}`;
        }
      }
    }
  },
  scales: {
    x: {
      beginAtZero: true,
      grid: {
        color: 'rgba(255, 255, 255, 0.04)',
        tickColor: 'transparent'
      },
      ticks: {
        color: '#94a3b8',
        font: { size: 11 },
        callback: (val) => {
          if (horizontal && isCurrency) {
            if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
            return `$${val}`;
          }
          return val;
        }
      },
      border: { display: false }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(255, 255, 255, 0.04)',
        tickColor: 'transparent'
      },
      ticks: {
        color: '#94a3b8',
        font: { size: 11 },
        callback: (val) => {
          if (!horizontal && isCurrency) {
            if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
            return `$${val}`;
          }
          return val;
        }
      },
      border: { display: false }
    }
  }
});

/**
 * Standard Doughnut Chart Options
 */
export const getDoughnutChartOptions = (unit = '') => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '70%',
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {
        color: '#cbd5e1',
        padding: 16,
        usePointStyle: true,
        pointStyle: 'circle',
        boxWidth: 8,
        boxHeight: 8,
        font: {
          size: 11,
          weight: '500'
        }
      }
    },
    tooltip: {
      ...glassTooltipStyle,
      callbacks: {
        label: (context) => {
          const val = context.parsed;
          const label = context.label || '';
          return ` ${label}: ${val.toLocaleString()} ${unit}`;
        }
      }
    }
  }
});

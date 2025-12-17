import { useState, useEffect, useMemo } from 'react'
import Papa from 'papaparse'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import './App.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const COLORS = {
  WINE: { main: '#8B0A50', light: 'rgba(139, 10, 80, 0.3)', gradient: ['#8B0A50', '#C71585'] },
  BEER: { main: '#DAA520', light: 'rgba(218, 165, 32, 0.3)', gradient: ['#DAA520', '#FFD700'] },
  LIQUOR: { main: '#1E90FF', light: 'rgba(30, 144, 255, 0.3)', gradient: ['#1E90FF', '#00CED1'] },
  KEGS: { main: '#2E8B57', light: 'rgba(46, 139, 87, 0.3)', gradient: ['#2E8B57', '#3CB371'] },
  STR_SUPPLIES: { main: '#9370DB', light: 'rgba(147, 112, 219, 0.3)', gradient: ['#9370DB', '#BA55D3'] },
  REF: { main: '#FF6347', light: 'rgba(255, 99, 71, 0.3)', gradient: ['#FF6347', '#FF7F50'] },
  default: { main: '#708090', light: 'rgba(112, 128, 144, 0.3)', gradient: ['#708090', '#778899'] }
}

function App() {
  const [rawData, setRawData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTypes, setSelectedTypes] = useState([])
  const [selectedYear, setSelectedYear] = useState('all')
  const [chartType, setChartType] = useState('line')

  // Load and parse CSV
  useEffect(() => {
    Papa.parse('/Warehouse_and_Retail_Sales.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setRawData(results.data)
        setLoading(false)
      },
      error: (err) => {
        setError(err.message)
        setLoading(false)
      }
    })
  }, [])

  // Get unique item types and years
  const { itemTypes, years } = useMemo(() => {
    const types = new Set()
    const yrs = new Set()
    rawData.forEach(row => {
      if (row['ITEM TYPE']) types.add(row['ITEM TYPE'])
      if (row['YEAR']) yrs.add(row['YEAR'])
    })
    return {
      itemTypes: Array.from(types).sort(),
      years: Array.from(yrs).sort()
    }
  }, [rawData])

  // Initialize selected types when data loads
  useEffect(() => {
    if (itemTypes.length > 0 && selectedTypes.length === 0) {
      setSelectedTypes(itemTypes.slice(0, 3))
    }
  }, [itemTypes])

  // Aggregate data by year, month, and item type
  const aggregatedData = useMemo(() => {
    const data = {}
    
    rawData.forEach(row => {
      const year = row['YEAR']
      const month = parseInt(row['MONTH']) || 0
      const type = row['ITEM TYPE']
      const retailSales = parseFloat(row['RETAIL SALES']) || 0
      const warehouseSales = parseFloat(row['WAREHOUSE SALES']) || 0
      const retailTransfers = parseFloat(row['RETAIL TRANSFERS']) || 0
      
      if (!type || month < 1 || month > 12) return
      
      const key = `${year}-${month}-${type}`
      if (!data[key]) {
        data[key] = { year, month, type, retailSales: 0, warehouseSales: 0, retailTransfers: 0, totalSales: 0 }
      }
      data[key].retailSales += retailSales
      data[key].warehouseSales += warehouseSales
      data[key].retailTransfers += retailTransfers
      data[key].totalSales += retailSales + warehouseSales
    })
    
    return Object.values(data)
  }, [rawData])

  // Filter and prepare chart data
  const chartData = useMemo(() => {
    const filteredData = aggregatedData.filter(row => {
      const typeMatch = selectedTypes.includes(row.type)
      const yearMatch = selectedYear === 'all' || row.year === selectedYear
      return typeMatch && yearMatch
    })

    // Group by month for each type
    const monthlyByType = {}
    selectedTypes.forEach(type => {
      monthlyByType[type] = Array(12).fill(0)
    })

    filteredData.forEach(row => {
      if (monthlyByType[row.type]) {
        monthlyByType[row.type][row.month - 1] += row.totalSales
      }
    })

    const datasets = selectedTypes.map(type => {
      const color = COLORS[type] || COLORS.default
      return {
        label: type,
        data: monthlyByType[type],
        borderColor: color.main,
        backgroundColor: chartType === 'line' ? color.light : color.main,
        fill: chartType === 'line',
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      }
    })

    return {
      labels: MONTHS,
      datasets
    }
  }, [aggregatedData, selectedTypes, selectedYear, chartType])

  // Summary stats for doughnut chart
  const summaryData = useMemo(() => {
    const totals = {}
    aggregatedData.forEach(row => {
      const yearMatch = selectedYear === 'all' || row.year === selectedYear
      if (!yearMatch) return
      if (!totals[row.type]) totals[row.type] = 0
      totals[row.type] += row.totalSales
    })

    const labels = Object.keys(totals).sort((a, b) => totals[b] - totals[a])
    const data = labels.map(l => totals[l])
    const colors = labels.map(l => (COLORS[l] || COLORS.default).main)

    return { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] }
  }, [aggregatedData, selectedYear])

  // Toggle item type selection
  const toggleType = (type) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#e0e0e0',
          font: { family: "'JetBrains Mono', monospace", size: 12 },
          padding: 20,
          usePointStyle: true,
        }
      },
      title: {
        display: true,
        text: selectedYear === 'all' ? 'Monthly Sales (All Years Combined)' : `Monthly Sales - ${selectedYear}`,
        color: '#fff',
        font: { family: "'Playfair Display', serif", size: 20, weight: '600' },
        padding: { bottom: 30 }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        titleFont: { family: "'JetBrains Mono', monospace" },
        bodyFont: { family: "'JetBrains Mono', monospace" },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#a0a0a0', font: { family: "'JetBrains Mono', monospace" } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#a0a0a0',
          font: { family: "'JetBrains Mono', monospace" },
          callback: (value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
        }
      }
    }
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#e0e0e0',
          font: { family: "'JetBrains Mono', monospace", size: 11 },
          padding: 15,
          usePointStyle: true,
        }
      },
      title: {
        display: true,
        text: 'Sales Distribution by Category',
        color: '#fff',
        font: { family: "'Playfair Display', serif", size: 18, weight: '600' },
        padding: { bottom: 20 }
      }
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading sales data...</p>
        <p className="loading-sub">Processing 300k+ records</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error Loading Data</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Warehouse & Retail Sales</h1>
        <p className="subtitle">Sales Analytics Dashboard</p>
      </header>

      <div className="controls">
        <div className="control-section">
          <h3>Product Category</h3>
          <div className="type-filters">
            {itemTypes.map(type => (
              <button
                key={type}
                className={`type-btn ${selectedTypes.includes(type) ? 'active' : ''}`}
                onClick={() => toggleType(type)}
                style={{
                  '--btn-color': (COLORS[type] || COLORS.default).main,
                  '--btn-light': (COLORS[type] || COLORS.default).light
                }}
              >
                <span className="type-indicator"></span>
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="control-section">
          <h3>Year</h3>
          <div className="year-filters">
            <button
              className={`year-btn ${selectedYear === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedYear('all')}
            >
              All Years
            </button>
            {years.map(year => (
              <button
                key={year}
                className={`year-btn ${selectedYear === year ? 'active' : ''}`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="control-section">
          <h3>Chart Type</h3>
          <div className="chart-type-toggle">
            <button
              className={`chart-btn ${chartType === 'line' ? 'active' : ''}`}
              onClick={() => setChartType('line')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M3.5 18.5l6-6 4 4 7.5-7.5L21 10V3h-7l1.5 1.5-6 6-4-4-6 6 1 1z"/>
              </svg>
              Line
            </button>
            <button
              className={`chart-btn ${chartType === 'bar' ? 'active' : ''}`}
              onClick={() => setChartType('bar')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M22 21H2V3h2v16h2v-9h4v9h2V6h4v13h2v-5h4v7z"/>
              </svg>
              Bar
            </button>
          </div>
        </div>
      </div>

      <div className="charts-container">
        <div className="main-chart">
          {chartType === 'line' ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <Bar data={chartData} options={chartOptions} />
          )}
        </div>
        <div className="side-chart">
          <Doughnut data={summaryData} options={doughnutOptions} />
        </div>
      </div>

      <div className="stats-grid">
        {selectedTypes.map(type => {
          const typeData = aggregatedData.filter(r => 
            r.type === type && (selectedYear === 'all' || r.year === selectedYear)
          )
          const total = typeData.reduce((sum, r) => sum + r.totalSales, 0)
          const retail = typeData.reduce((sum, r) => sum + r.retailSales, 0)
          const warehouse = typeData.reduce((sum, r) => sum + r.warehouseSales, 0)
          const color = COLORS[type] || COLORS.default
          
          return (
            <div key={type} className="stat-card" style={{ '--card-color': color.main }}>
              <div className="stat-header">
                <span className="stat-dot" style={{ background: color.main }}></span>
                <h4>{type}</h4>
              </div>
              <div className="stat-value">{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="stat-label">Total Sales</div>
              <div className="stat-breakdown">
                <div className="stat-row">
                  <span>Retail</span>
                  <span>{retail.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="stat-row">
                  <span>Warehouse</span>
                  <span>{warehouse.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <footer className="footer">
        <p>Data: Warehouse & Retail Sales Dataset • {rawData.length.toLocaleString()} records</p>
      </footer>
    </div>
  )
}

export default App

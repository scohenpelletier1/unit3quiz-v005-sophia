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
import { auth, db } from './firebase'
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
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

const TYPE_COLORS = {
  WINE: { main: '#8B0A50', light: 'rgba(139, 10, 80, 0.3)' },
  BEER: { main: '#DAA520', light: 'rgba(218, 165, 32, 0.3)' },
  LIQUOR: { main: '#1E90FF', light: 'rgba(30, 144, 255, 0.3)' },
  KEGS: { main: '#2E8B57', light: 'rgba(46, 139, 87, 0.3)' },
  STR_SUPPLIES: { main: '#9370DB', light: 'rgba(147, 112, 219, 0.3)' },
  REF: { main: '#FF6347', light: 'rgba(255, 99, 71, 0.3)' },
  default: { main: '#708090', light: 'rgba(112, 128, 144, 0.3)' }
}

// Generate distinct colors for warehouses
const WAREHOUSE_PALETTE = [
  { main: '#FF6B6B', light: 'rgba(255, 107, 107, 0.3)' },
  { main: '#4ECDC4', light: 'rgba(78, 205, 196, 0.3)' },
  { main: '#45B7D1', light: 'rgba(69, 183, 209, 0.3)' },
  { main: '#96CEB4', light: 'rgba(150, 206, 180, 0.3)' },
  { main: '#FFEAA7', light: 'rgba(255, 234, 167, 0.3)' },
  { main: '#DDA0DD', light: 'rgba(221, 160, 221, 0.3)' },
  { main: '#98D8C8', light: 'rgba(152, 216, 200, 0.3)' },
  { main: '#F7DC6F', light: 'rgba(247, 220, 111, 0.3)' },
  { main: '#BB8FCE', light: 'rgba(187, 143, 206, 0.3)' },
  { main: '#85C1E9', light: 'rgba(133, 193, 233, 0.3)' },
  { main: '#F8B500', light: 'rgba(248, 181, 0, 0.3)' },
  { main: '#00CED1', light: 'rgba(0, 206, 209, 0.3)' },
  { main: '#FF7F50', light: 'rgba(255, 127, 80, 0.3)' },
  { main: '#9FE2BF', light: 'rgba(159, 226, 191, 0.3)' },
  { main: '#DE3163', light: 'rgba(222, 49, 99, 0.3)' },
]

function App() {
  const [rawData, setRawData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTypes, setSelectedTypes] = useState([])
  const [selectedWarehouses, setSelectedWarehouses] = useState([])
  const [selectedYear, setSelectedYear] = useState('all')
  const [chartType, setChartType] = useState('line')
  const [viewMode, setViewMode] = useState('warehouse') // 'category' or 'warehouse'
  const [warehouseSearch, setWarehouseSearch] = useState('')
  
  // Auth state
  const [user, setUser] = useState(null)
  const [userName, setUserName] = useState('')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState('register') // 'register' or 'login'
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [showThankYou, setShowThankYou] = useState(false)
  const [thankYouName, setThankYouName] = useState('')

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        // Fetch user's name from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'voters', currentUser.uid))
          if (userDoc.exists()) {
            setUserName(userDoc.data().name || '')
          }
        } catch (err) {
          console.error('Error fetching user data:', err)
        }
      } else {
        setUserName('')
      }
    })
    return () => unsubscribe()
  }, [])

  // Handle registration
  const handleRegister = async (e) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        authForm.email, 
        authForm.password
      )
      
      // Store user data in Firestore
      await setDoc(doc(db, 'voters', userCredential.user.uid), {
        name: authForm.name,
        email: authForm.email,
        registeredAt: new Date().toISOString(),
        supportedCandidate: 'Sophia Cohen-Pelletier'
      })
      
      setUserName(authForm.name)
      setThankYouName(authForm.name)
      setShowAuthModal(false)
      setShowThankYou(true)
      setAuthForm({ name: '', email: '', password: '' })
      
      // Hide thank you message after 5 seconds
      setTimeout(() => setShowThankYou(false), 5000)
    } catch (err) {
      setAuthError(getAuthErrorMessage(err.code))
    } finally {
      setAuthLoading(false)
    }
  }

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        authForm.email, 
        authForm.password
      )
      
      // Fetch user's name from Firestore
      const userDoc = await getDoc(doc(db, 'voters', userCredential.user.uid))
      const fetchedName = userDoc.exists() ? userDoc.data().name : 'Supporter'
      
      setUserName(fetchedName)
      setThankYouName(fetchedName)
      setShowAuthModal(false)
      setShowThankYou(true)
      setAuthForm({ name: '', email: '', password: '' })
      
      // Hide thank you message after 5 seconds
      setTimeout(() => setShowThankYou(false), 5000)
    } catch (err) {
      setAuthError(getAuthErrorMessage(err.code))
    } finally {
      setAuthLoading(false)
    }
  }

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth)
      setUserName('')
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }

  // Get friendly error messages
  const getAuthErrorMessage = (code) => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Try logging in instead.'
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.'
      case 'auth/invalid-email':
        return 'Please enter a valid email address.'
      case 'auth/user-not-found':
        return 'No account found with this email.'
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.'
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please try again.'
      default:
        return 'An error occurred. Please try again.'
    }
  }

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

  // Get unique item types, warehouses, and years
  const { itemTypes, warehouses, years } = useMemo(() => {
    const types = new Set()
    const suppliers = new Map() // supplier -> total sales for sorting
    const yrs = new Set()
    
    rawData.forEach(row => {
      if (row['ITEM TYPE']) types.add(row['ITEM TYPE'])
      if (row['YEAR']) yrs.add(row['YEAR'])
      if (row['SUPPLIER']) {
        const supplier = row['SUPPLIER']
        const sales = (parseFloat(row['RETAIL SALES']) || 0) + (parseFloat(row['WAREHOUSE SALES']) || 0)
        suppliers.set(supplier, (suppliers.get(supplier) || 0) + sales)
      }
    })
    
    // Sort warehouses by total sales (descending)
    const sortedWarehouses = Array.from(suppliers.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
    
    return {
      itemTypes: Array.from(types).sort(),
      warehouses: sortedWarehouses,
      years: Array.from(yrs).sort()
    }
  }, [rawData])

  // Initialize selections when data loads
  useEffect(() => {
    if (itemTypes.length > 0 && selectedTypes.length === 0) {
      setSelectedTypes(itemTypes.slice(0, 3))
    }
  }, [itemTypes])

  useEffect(() => {
    if (warehouses.length > 0 && selectedWarehouses.length === 0) {
      setSelectedWarehouses(warehouses.slice(0, 5))
    }
  }, [warehouses])

  // Get color for warehouse by index
  const getWarehouseColor = (warehouse) => {
    const idx = warehouses.indexOf(warehouse) % WAREHOUSE_PALETTE.length
    return WAREHOUSE_PALETTE[idx]
  }

  // Aggregate data by year, month, and category/warehouse
  const aggregatedByCategory = useMemo(() => {
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

  const aggregatedByWarehouse = useMemo(() => {
    const data = {}
    
    rawData.forEach(row => {
      const year = row['YEAR']
      const month = parseInt(row['MONTH']) || 0
      const supplier = row['SUPPLIER']
      const retailSales = parseFloat(row['RETAIL SALES']) || 0
      const warehouseSales = parseFloat(row['WAREHOUSE SALES']) || 0
      const retailTransfers = parseFloat(row['RETAIL TRANSFERS']) || 0
      
      if (!supplier || month < 1 || month > 12) return
      
      const key = `${year}-${month}-${supplier}`
      if (!data[key]) {
        data[key] = { year, month, warehouse: supplier, retailSales: 0, warehouseSales: 0, retailTransfers: 0, totalSales: 0 }
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
    if (viewMode === 'category') {
      const filteredData = aggregatedByCategory.filter(row => {
        const typeMatch = selectedTypes.includes(row.type)
        const yearMatch = selectedYear === 'all' || row.year === selectedYear
        return typeMatch && yearMatch
      })

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
        const color = TYPE_COLORS[type] || TYPE_COLORS.default
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

      return { labels: MONTHS, datasets }
    } else {
      // Warehouse view
      const filteredData = aggregatedByWarehouse.filter(row => {
        const warehouseMatch = selectedWarehouses.includes(row.warehouse)
        const yearMatch = selectedYear === 'all' || row.year === selectedYear
        return warehouseMatch && yearMatch
      })

      const monthlyByWarehouse = {}
      selectedWarehouses.forEach(wh => {
        monthlyByWarehouse[wh] = Array(12).fill(0)
      })

      filteredData.forEach(row => {
        if (monthlyByWarehouse[row.warehouse]) {
          monthlyByWarehouse[row.warehouse][row.month - 1] += row.totalSales
        }
      })

      const datasets = selectedWarehouses.map(wh => {
        const color = getWarehouseColor(wh)
        // Shorten warehouse names for legend
        const shortName = wh.length > 25 ? wh.substring(0, 22) + '...' : wh
        return {
          label: shortName,
          data: monthlyByWarehouse[wh],
          borderColor: color.main,
          backgroundColor: chartType === 'line' ? color.light : color.main,
          fill: chartType === 'line',
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        }
      })

      return { labels: MONTHS, datasets }
    }
  }, [viewMode, aggregatedByCategory, aggregatedByWarehouse, selectedTypes, selectedWarehouses, selectedYear, chartType, warehouses])

  // Summary stats for doughnut chart
  const summaryData = useMemo(() => {
    if (viewMode === 'category') {
      const totals = {}
      aggregatedByCategory.forEach(row => {
        const yearMatch = selectedYear === 'all' || row.year === selectedYear
        if (!yearMatch) return
        if (!totals[row.type]) totals[row.type] = 0
        totals[row.type] += row.totalSales
      })

      const labels = Object.keys(totals).sort((a, b) => totals[b] - totals[a])
      const data = labels.map(l => totals[l])
      const colors = labels.map(l => (TYPE_COLORS[l] || TYPE_COLORS.default).main)

      return { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] }
    } else {
      const totals = {}
      aggregatedByWarehouse.forEach(row => {
        const yearMatch = selectedYear === 'all' || row.year === selectedYear
        if (!yearMatch) return
        if (!totals[row.warehouse]) totals[row.warehouse] = 0
        totals[row.warehouse] += row.totalSales
      })

      // Top 10 warehouses for doughnut
      const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 10)
      const labels = sorted.map(([name]) => name.length > 20 ? name.substring(0, 17) + '...' : name)
      const data = sorted.map(([, val]) => val)
      const colors = sorted.map(([name]) => getWarehouseColor(name).main)

      return { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] }
    }
  }, [viewMode, aggregatedByCategory, aggregatedByWarehouse, selectedYear, warehouses])

  // Toggle selections
  const toggleType = (type) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const toggleWarehouse = (warehouse) => {
    setSelectedWarehouses(prev => 
      prev.includes(warehouse) 
        ? prev.filter(w => w !== warehouse)
        : [...prev, warehouse]
    )
  }

  // Filtered warehouses for display
  const filteredWarehouses = useMemo(() => {
    if (!warehouseSearch) return warehouses.slice(0, 20)
    return warehouses.filter(w => 
      w.toLowerCase().includes(warehouseSearch.toLowerCase())
    ).slice(0, 20)
  }, [warehouses, warehouseSearch])

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
          font: { family: "'JetBrains Mono', monospace", size: 11 },
          padding: 15,
          usePointStyle: true,
          boxWidth: 8,
        }
      },
      title: {
        display: true,
        text: viewMode === 'warehouse' 
          ? (selectedYear === 'all' ? 'Monthly Sales by Warehouse (All Years)' : `Monthly Sales by Warehouse - ${selectedYear}`)
          : (selectedYear === 'all' ? 'Monthly Sales by Category (All Years)' : `Monthly Sales by Category - ${selectedYear}`),
        color: '#fff',
        font: { family: "'Playfair Display', serif", size: 18, weight: '600' },
        padding: { bottom: 20 }
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
          font: { family: "'JetBrains Mono', monospace", size: 10 },
          padding: 10,
          usePointStyle: true,
        }
      },
      title: {
        display: true,
        text: viewMode === 'warehouse' ? 'Top 10 Warehouses' : 'Sales by Category',
        color: '#fff',
        font: { family: "'Playfair Display', serif", size: 16, weight: '600' },
        padding: { bottom: 15 }
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

  const currentSelection = viewMode === 'warehouse' ? selectedWarehouses : selectedTypes
  const currentAggregated = viewMode === 'warehouse' ? aggregatedByWarehouse : aggregatedByCategory

  return (
    <div className="app">
      {/* Thank You Modal */}
      {showThankYou && (
        <div className="thank-you-overlay">
          <div className="thank-you-modal">
            <div className="thank-you-icon">✓</div>
            <h2>Thank you for your support, {thankYouName}!</h2>
            <p>Your voice matters. Together, we'll build a better future.</p>
            <p className="thank-you-signature">— Sophia Cohen-Pelletier</p>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="auth-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <button className="auth-close" onClick={() => setShowAuthModal(false)}>×</button>
            
            <div className="auth-header">
              <h2>{authMode === 'register' ? 'Register to Vote' : 'Welcome Back'}</h2>
              <p>{authMode === 'register' 
                ? 'Join our community of supporters' 
                : 'Sign in to your account'}</p>
            </div>

            <form onSubmit={authMode === 'register' ? handleRegister : handleLogin}>
              {authMode === 'register' && (
                <div className="auth-field">
                  <label>Your Name</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={authForm.name}
                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    required
                  />
                </div>
              )}
              
              <div className="auth-field">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  required
                />
              </div>
              
              <div className="auth-field">
                <label>Password</label>
                <input
                  type="password"
                  placeholder={authMode === 'register' ? 'Create a password' : 'Enter your password'}
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  required
                />
              </div>

              {authError && <div className="auth-error">{authError}</div>}

              <button type="submit" className="auth-submit" disabled={authLoading}>
                {authLoading ? 'Please wait...' : (authMode === 'register' ? 'Register My Support' : 'Sign In')}
              </button>
            </form>

            <div className="auth-switch">
              {authMode === 'register' ? (
                <p>Already registered? <button onClick={() => { setAuthMode('login'); setAuthError(''); }}>Sign in</button></p>
              ) : (
                <p>New supporter? <button onClick={() => { setAuthMode('register'); setAuthError(''); }}>Register now</button></p>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="header">
        <h1>Warehouse & Retail Sales</h1>
        <p className="subtitle">Sales Analytics Dashboard</p>
        
        {/* Auth Button */}
        <div className="auth-button-container">
          {user ? (
            <div className="user-info">
              <span className="user-greeting">Welcome, {userName || 'Supporter'}!</span>
              <button className="auth-logout-btn" onClick={handleLogout}>Sign Out</button>
            </div>
          ) : (
            <button 
              className="register-vote-btn"
              onClick={() => { setShowAuthModal(true); setAuthMode('register'); setAuthError(''); }}
            >
              <span className="vote-icon">🗳️</span>
              Register to Vote
            </button>
          )}
        </div>
      </header>

      <div className="controls">
        <div className="control-section view-mode-section">
          <h3>View By</h3>
          <div className="view-mode-toggle">
            <button
              className={`view-btn ${viewMode === 'warehouse' ? 'active' : ''}`}
              onClick={() => setViewMode('warehouse')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/>
              </svg>
              By Warehouse
            </button>
            <button
              className={`view-btn ${viewMode === 'category' ? 'active' : ''}`}
              onClick={() => setViewMode('category')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
              By Category
            </button>
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

      {/* Selection Panel */}
      <div className="selection-panel">
        <h3>{viewMode === 'warehouse' ? `Select Warehouses (${warehouses.length} total)` : 'Select Categories'}</h3>
        
        {viewMode === 'warehouse' && (
          <div className="search-box">
            <input
              type="text"
              placeholder="Search warehouses..."
              value={warehouseSearch}
              onChange={(e) => setWarehouseSearch(e.target.value)}
            />
          </div>
        )}
        
        <div className="selection-grid">
          {viewMode === 'category' ? (
            itemTypes.map(type => (
              <button
                key={type}
                className={`type-btn ${selectedTypes.includes(type) ? 'active' : ''}`}
                onClick={() => toggleType(type)}
                style={{
                  '--btn-color': (TYPE_COLORS[type] || TYPE_COLORS.default).main,
                  '--btn-light': (TYPE_COLORS[type] || TYPE_COLORS.default).light
                }}
              >
                <span className="type-indicator"></span>
                {type}
              </button>
            ))
          ) : (
            filteredWarehouses.map(wh => {
              const color = getWarehouseColor(wh)
              return (
                <button
                  key={wh}
                  className={`type-btn warehouse-btn ${selectedWarehouses.includes(wh) ? 'active' : ''}`}
                  onClick={() => toggleWarehouse(wh)}
                  style={{
                    '--btn-color': color.main,
                    '--btn-light': color.light
                  }}
                  title={wh}
                >
                  <span className="type-indicator"></span>
                  <span className="btn-text">{wh.length > 30 ? wh.substring(0, 27) + '...' : wh}</span>
        </button>
              )
            })
          )}
        </div>
        
        {viewMode === 'warehouse' && (
          <p className="selection-hint">
            Showing top {filteredWarehouses.length} of {warehouses.length} warehouses
            {warehouseSearch && ` matching "${warehouseSearch}"`}
          </p>
        )}
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
        {viewMode === 'category' ? (
          selectedTypes.map(type => {
            const typeData = aggregatedByCategory.filter(r => 
              r.type === type && (selectedYear === 'all' || r.year === selectedYear)
            )
            const total = typeData.reduce((sum, r) => sum + r.totalSales, 0)
            const retail = typeData.reduce((sum, r) => sum + r.retailSales, 0)
            const warehouse = typeData.reduce((sum, r) => sum + r.warehouseSales, 0)
            const color = TYPE_COLORS[type] || TYPE_COLORS.default
            
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
          })
        ) : (
          selectedWarehouses.slice(0, 6).map(wh => {
            const whData = aggregatedByWarehouse.filter(r => 
              r.warehouse === wh && (selectedYear === 'all' || r.year === selectedYear)
            )
            const total = whData.reduce((sum, r) => sum + r.totalSales, 0)
            const retail = whData.reduce((sum, r) => sum + r.retailSales, 0)
            const warehouse = whData.reduce((sum, r) => sum + r.warehouseSales, 0)
            const color = getWarehouseColor(wh)
            
            return (
              <div key={wh} className="stat-card" style={{ '--card-color': color.main }}>
                <div className="stat-header">
                  <span className="stat-dot" style={{ background: color.main }}></span>
                  <h4 title={wh}>{wh.length > 20 ? wh.substring(0, 17) + '...' : wh}</h4>
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
          })
        )}
      </div>

      <section className="statement-of-intent">
        <div className="statement-header">
          <div className="statement-badge">Statement of Intent</div>
          <h2>Transparency in Commerce, Accountability in Governance</h2>
        </div>
        
        <div className="statement-content">
          <div className="statement-block">
            <h3>Understanding the Data</h3>
            <p>
              This dashboard presents comprehensive warehouse and retail sales data spanning 2017-2020, 
              encompassing over <strong>{rawData.length.toLocaleString()}</strong> individual transactions across 
              <strong> {warehouses.length}</strong> distribution partners and multiple product categories. 
              The data reveals seasonal purchasing patterns, distribution channel efficiencies, and the economic 
              footprint of regulated beverage sales in our community.
            </p>
          </div>

          <div className="statement-block">
            <h3>My Position</h3>
            <p>
              As your representative, I believe in <strong>data-driven policy making</strong>. This sales data 
              demonstrates the significant economic contribution of the regulated beverage industry to our 
              local economy—creating jobs, generating tax revenue, and supporting small businesses throughout 
              our supply chain.
            </p>
            <p>
              I stand for <strong>balanced regulation</strong> that protects public health while fostering 
              economic growth. The transparency shown here reflects my commitment to open governance—you 
              deserve to see the same data that informs policy decisions.
            </p>
          </div>

          <div className="statement-block">
            <h3>My Commitment to You</h3>
            <ul className="commitment-list">
              <li>
                <span className="commitment-icon">📊</span>
                <span>Support evidence-based policies that reflect actual market conditions</span>
              </li>
              <li>
                <span className="commitment-icon">💼</span>
                <span>Protect local businesses and the jobs they create in our community</span>
              </li>
              <li>
                <span className="commitment-icon">🛡️</span>
                <span>Maintain responsible oversight while reducing unnecessary bureaucratic burden</span>
              </li>
              <li>
                <span className="commitment-icon">🤝</span>
                <span>Ensure fair competition and market access for all stakeholders</span>
              </li>
            </ul>
          </div>

          <div className="statement-cta">
            <p className="cta-text">
              When you vote for me, you vote for <em>transparency</em>, <em>accountability</em>, and 
              <em> policies grounded in real data </em>— not political rhetoric.
            </p>
            <div className="signature">
              <span className="signature-line"></span>
              <span className="signature-text">~Your Candidate for Progress~</span>
              <span className="signature-text">Sophia Cohen-Pelletier</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>Data: Warehouse & Retail Sales Dataset • {rawData.length.toLocaleString()} records • {warehouses.length} warehouses</p>
        <p className="footer-disclaimer">Paid for by Citizens for Transparent Governance</p>
      </footer>
    </div>
  )
}

export default App

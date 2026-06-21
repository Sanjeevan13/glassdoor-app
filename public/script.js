// ==========================================================================
// STATE MANAGEMENT & CONSTANTS
// ==========================================================================
let allCompanies = [];
let filteredCompanies = [];
let selectedCompany = null;

// Chart instances for recycling
let sentimentChart = null;
let categoryChart = null;
let predictionChart = null;

const SUGGESTED_COMPANIES = ["IBM", "Microsoft", "Apple", "Deloitte", "Oracle"];

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
const searchInput = document.getElementById("company-search-input");
const clearSearchBtn = document.getElementById("clear-search-btn");
const autocompleteList = document.getElementById("autocomplete-list");
const welcomeSection = document.getElementById("welcome-section");
const dashboardSection = document.getElementById("dashboard-section");
const suggestedTagsContainer = document.getElementById("suggested-tags-container");

// Dashboard DOM elements
const companyTitle = document.getElementById("company-title");
const reviewCountBadge = document.getElementById("review-count-badge");
const ratingNumber = document.getElementById("rating-number");
const ratingStarsContainer = document.getElementById("rating-stars-container");
const prosListContainer = document.getElementById("pros-list-container");
const consListContainer = document.getElementById("cons-list-container");

// Sandbox elements
const predictorForm = document.getElementById("predictor-form");
const sandboxPros = document.getElementById("sandbox-pros");
const sandboxCons = document.getElementById("sandbox-cons");
const analyzeBtn = document.getElementById("analyze-btn");
const btnText = document.getElementById("btn-text");
const btnLoader = document.getElementById("btn-loader");
const predictionResultWrapper = document.getElementById("prediction-result-wrapper");
const predictedLabelText = document.getElementById("predicted-label-text");

// Keyboard navigation active index
let activeDropdownIndex = -1;

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  // Initialize Lucide Icons
  lucide.createIcons();
  
  // Render quick-suggest tags
  renderSuggestedTags();
  
  // Fetch initial company list
  fetchCompanies();
  
  // Setup Event Listeners
  setupEventListeners();
});

// ==========================================================================
// API CALLS
// ==========================================================================
async function fetchCompanies() {
  try {
    const response = await fetch("/api/companies");
    if (!response.ok) throw new Error("Failed to load companies list.");
    const data = await response.json();
    allCompanies = data.companies || [];
  } catch (error) {
    console.error("Error fetching companies list:", error);
  }
}

async function fetchCompanySummary(companyName) {
  // Show global loaders or page transitions if needed
  try {
    const response = await fetch(`/api/summary?company=${encodeURIComponent(companyName)}`);
    if (!response.ok) {
      if (response.status === 404) {
        alert(`Company "${companyName}" not found.`);
      } else {
        throw new Error("Failed to load summary data.");
      }
      return;
    }
    const summary = await response.json();
    renderDashboard(summary);
  } catch (error) {
    console.error("Error loading company summary:", error);
    alert("Could not load dashboard data. Please try again.");
  }
}

async function runSentimentPrediction(prosText, consText) {
  try {
    const response = await fetch("/api/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ pros: prosText, cons: consText })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Prediction request failed.");
    }
    
    const result = await response.json();
    renderPredictionResult(result);
  } catch (error) {
    console.error("Prediction error:", error);
    alert(error.message || "Model sandbox failed to return a prediction.");
  } finally {
    // Reset button loader
    analyzeBtn.disabled = false;
    btnText.style.display = "inline";
    btnLoader.style.display = "none";
  }
}

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================
function setupEventListeners() {
  // Search input typing and searching
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.trim();
    if (query.length > 0) {
      clearSearchBtn.style.display = "flex";
      filterCompaniesList(query);
    } else {
      clearSearchBtn.style.display = "none";
      hideDropdown();
    }
  });
  
  // Clear search box
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchBtn.style.display = "none";
    hideDropdown();
    showLandingState();
    searchInput.focus();
  });
  
  // Close dropdown on click outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#search-wrapper")) {
      hideDropdown();
    }
  });
  
  // Key navigation in autocomplete list
  searchInput.addEventListener("keydown", (e) => {
    const items = autocompleteList.getElementsByClassName("autocomplete-item");
    if (autocompleteList.style.display === "none" || items.length === 0) return;
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeDropdownIndex = (activeDropdownIndex + 1) % items.length;
      highlightDropdownItem(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeDropdownIndex = (activeDropdownIndex - 1 + items.length) % items.length;
      highlightDropdownItem(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeDropdownIndex > -1 && items[activeDropdownIndex]) {
        items[activeDropdownIndex].click();
      } else {
        // Match exact or select first if matching
        if (filteredCompanies.length > 0) {
          selectCompanyItem(filteredCompanies[0]);
        }
      }
    } else if (e.key === "Escape") {
      hideDropdown();
    }
  });
  
  // Predictor sandbox submit
  predictorForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const prosVal = sandboxPros.value;
    const consVal = sandboxCons.value;
    
    if (!prosVal.trim() && !consVal.trim()) {
      alert("Please write something in the Pros or Cons sections first.");
      return;
    }
    
    // Set loader
    analyzeBtn.disabled = true;
    btnText.style.display = "none";
    btnLoader.style.display = "inline-block";
    
    runSentimentPrediction(prosVal, consVal);
  });
}

// ==========================================================================
// SEARCH & AUTOCOMPLETE UI LOGIC
// ==========================================================================
function filterCompaniesList(query) {
  filteredCompanies = allCompanies.filter(comp => 
    comp.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10); // Display limit 10
  
  renderAutocompleteDropdown();
}

function renderAutocompleteDropdown() {
  autocompleteList.innerHTML = "";
  activeDropdownIndex = -1;
  
  if (filteredCompanies.length === 0) {
    const noMatch = document.createElement("div");
    noMatch.className = "autocomplete-no-match";
    noMatch.innerText = "No matching companies found";
    autocompleteList.appendChild(noMatch);
  } else {
    filteredCompanies.forEach((company, index) => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";
      item.innerHTML = `<span>${company}</span><i data-lucide="chevron-right" style="width:14px;height:14px;opacity:0.6;"></i>`;
      
      item.addEventListener("click", () => {
        selectCompanyItem(company);
      });
      
      autocompleteList.appendChild(item);
    });
    lucide.createIcons();
  }
  
  autocompleteList.style.display = "block";
}

function highlightDropdownItem(items) {
  // Clear previous highlights
  Array.from(items).forEach(item => item.classList.remove("selected"));
  
  if (activeDropdownIndex > -1 && items[activeDropdownIndex]) {
    items[activeDropdownIndex].classList.add("selected");
    // Ensure item is scrolled into view
    items[activeDropdownIndex].scrollIntoView({ block: "nearest" });
  }
}

function hideDropdown() {
  autocompleteList.style.display = "none";
  activeDropdownIndex = -1;
}

function selectCompanyItem(companyName) {
  searchInput.value = companyName;
  clearSearchBtn.style.display = "flex";
  hideDropdown();
  selectedCompany = companyName;
  
  // Load data
  fetchCompanySummary(companyName);
}

function renderSuggestedTags() {
  suggestedTagsContainer.innerHTML = "";
  SUGGESTED_COMPANIES.forEach(comp => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-btn";
    btn.innerText = comp;
    btn.addEventListener("click", () => {
      selectCompanyItem(comp);
    });
    suggestedTagsContainer.appendChild(btn);
  });
}

function showLandingState() {
  welcomeSection.style.display = "flex";
  dashboardSection.style.display = "none";
  selectedCompany = null;
}

// ==========================================================================
// RENDERING DASHBOARD DATA
// ==========================================================================
function renderDashboard(summary) {
  // Hide landing view, show dashboard view
  welcomeSection.style.display = "none";
  dashboardSection.style.display = "block";
  
  // Set Text Values
  companyTitle.innerText = summary.firm;
  reviewCountBadge.innerText = `Based on ${summary.review_count} reviews`;
  ratingNumber.innerText = summary.overall_rating.toFixed(1);
  
  // Render Stars
  renderStars(summary.overall_rating);
  
  // Render Pros List
  prosListContainer.innerHTML = "";
  if (summary.pros_list && summary.pros_list.length > 0) {
    summary.pros_list.forEach(pro => {
      const li = document.createElement("li");
      li.innerText = capitalizeFirstLetter(pro);
      prosListContainer.appendChild(li);
    });
  } else {
    prosListContainer.innerHTML = `<li>No pros recorded for this company.</li>`;
  }
  
  // Render Cons List
  consListContainer.innerHTML = "";
  if (summary.cons_list && summary.cons_list.length > 0) {
    summary.cons_list.forEach(con => {
      const li = document.createElement("li");
      li.innerText = capitalizeFirstLetter(con);
      consListContainer.appendChild(li);
    });
  } else {
    consListContainer.innerHTML = `<li>No cons recorded for this company.</li>`;
  }
  
  // Render Sentiment Chart
  updateSentimentChart(summary.sentiment_pct);
  
  // Render Categories Ratings Chart
  updateCategoryChart(summary.sub_ratings);
}

function renderStars(rating) {
  ratingStarsContainer.innerHTML = "";
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  
  for (let i = 0; i < fullStars; i++) {
    const star = document.createElement("i");
    star.setAttribute("data-lucide", "star");
    star.className = "filled";
    ratingStarsContainer.appendChild(star);
  }
  
  if (hasHalf) {
    const star = document.createElement("i");
    star.setAttribute("data-lucide", "star-half");
    star.className = "filled";
    ratingStarsContainer.appendChild(star);
  }
  
  for (let i = 0; i < emptyStars; i++) {
    const star = document.createElement("i");
    star.setAttribute("data-lucide", "star");
    ratingStarsContainer.appendChild(star);
  }
  
  lucide.createIcons({
    attrs: {
      class: 'rating-stars-icon'
    },
    nameAttr: 'data-lucide'
  });
}

function updateSentimentChart(pctData) {
  const positive = pctData.Positive || 0.0;
  const neutral = pctData.Neutral || 0.0;
  const negative = pctData.Negative || 0.0;
  
  const chartOptions = {
    series: [positive, neutral, negative],
    labels: ['Positive', 'Neutral', 'Negative'],
    chart: {
      type: 'donut',
      height: 280,
      background: 'transparent',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800
      }
    },
    colors: ['#10b981', '#f59e0b', '#f43f5e'],
    legend: {
      position: 'bottom',
      labels: { colors: '#9ca3af' },
      fontFamily: 'Inter, sans-serif'
    },
    stroke: { show: false },
    dataLabels: {
      enabled: true,
      formatter: function (val) {
        return val.toFixed(1) + "%";
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '60%',
          labels: {
            show: true,
            name: { show: true, color: '#9ca3af', fontFamily: 'Plus Jakarta Sans' },
            value: { 
              show: true, 
              color: '#f3f4f6', 
              fontSize: '22px', 
              fontWeight: '800',
              fontFamily: 'Plus Jakarta Sans',
              formatter: (val) => `${val}%`
            },
            total: {
              show: true,
              label: 'Positive',
              color: '#10b981',
              fontSize: '14px',
              fontFamily: 'Plus Jakarta Sans',
              formatter: () => `${positive}%`
            }
          }
        }
      }
    },
    theme: { mode: 'dark' },
    tooltip: {
      y: {
        formatter: (val) => `${val}%`
      }
    }
  };
  
  if (sentimentChart) {
    sentimentChart.destroy();
  }
  
  sentimentChart = new ApexCharts(document.querySelector("#sentiment-pie-chart"), chartOptions);
  sentimentChart.render();
}

function updateCategoryChart(subRatings) {
  const categories = Object.keys(subRatings);
  const values = Object.values(subRatings);
  
  const chartOptions = {
    series: [{
      name: 'Rating',
      data: values
    }],
    chart: {
      type: 'bar',
      height: 280,
      toolbar: { show: false },
      background: 'transparent',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800
      }
    },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '55%',
        borderRadius: 4,
        distributed: true
      }
    },
    colors: values.map(val => {
      if (val >= 4.0) return '#10b981'; // Green
      if (val >= 3.2) return '#6366f1'; // Violet
      if (val >= 2.6) return '#f59e0b'; // Amber
      return '#f43f5e'; // Rose
    }),
    dataLabels: {
      enabled: true,
      formatter: function (val) { return val.toFixed(1); },
      style: { 
        colors: ['#ffffff'],
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        fontWeight: 'bold'
      },
      offsetX: 10
    },
    xaxis: {
      categories: categories,
      labels: { 
        style: { 
          colors: '#9ca3af',
          fontFamily: 'Inter, sans-serif'
        } 
      },
      min: 0,
      max: 5
    },
    yaxis: {
      labels: { 
        style: { 
          colors: '#f3f4f6', 
          fontWeight: 600,
          fontFamily: 'Plus Jakarta Sans'
        } 
      }
    },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.05)',
      xaxis: { lines: { show: true } }
    },
    legend: { show: false },
    theme: { mode: 'dark' },
    tooltip: {
      y: {
        formatter: (val) => `${val} / 5.0`
      }
    }
  };
  
  if (categoryChart) {
    categoryChart.destroy();
  }
  
  categoryChart = new ApexCharts(document.querySelector("#category-bar-chart"), chartOptions);
  categoryChart.render();
}

// ==========================================================================
// PREDICTIVE MODEL UI LOGIC
// ==========================================================================
function renderPredictionResult(result) {
  // Clear previous custom prediction styles
  predictedLabelText.className = "";
  predictedLabelText.classList.add(`predicted-${result.sentiment}`);
  predictedLabelText.innerText = result.sentiment;
  
  // Show container
  predictionResultWrapper.style.display = "block";
  
  // Update Confidence distribution chart
  updatePredictionChart(result.probabilities || {});
  
  // Scroll to results slowly
  predictionResultWrapper.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function updatePredictionChart(probabilities) {
  const categories = Object.keys(probabilities);
  const values = Object.values(probabilities);
  
  const chartOptions = {
    series: [{
      name: 'Confidence',
      data: values
    }],
    chart: {
      type: 'bar',
      height: 180,
      toolbar: { show: false },
      background: 'transparent'
    },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '50%',
        borderRadius: 4,
        distributed: true
      }
    },
    colors: categories.map(cat => {
      if (cat === "Positive") return '#10b981';
      if (cat === "Neutral") return '#f59e0b';
      return '#f43f5e';
    }),
    dataLabels: {
      enabled: true,
      formatter: function (val) { return val.toFixed(1) + "%"; },
      style: { 
        colors: ['#ffffff'],
        fontFamily: 'Inter, sans-serif'
      }
    },
    xaxis: {
      categories: categories,
      labels: { 
        style: { 
          colors: '#9ca3af',
          fontFamily: 'Inter, sans-serif'
        } 
      },
      min: 0,
      max: 100
    },
    yaxis: {
      labels: { 
        style: { 
          colors: '#f3f4f6', 
          fontWeight: 600,
          fontFamily: 'Plus Jakarta Sans'
        } 
      }
    },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.05)',
      xaxis: { lines: { show: true } }
    },
    legend: { show: false },
    theme: { mode: 'dark' }
  };
  
  if (predictionChart) {
    predictionChart.destroy();
  }
  
  predictionChart = new ApexCharts(document.querySelector("#prediction-confidence-chart"), chartOptions);
  predictionChart.render();
}

// ==========================================================================
// HELPER UTILITIES
// ==========================================================================
function capitalizeFirstLetter(string) {
  if (!string) return "";
  return string.charAt(0).toUpperCase() + string.slice(1);
}

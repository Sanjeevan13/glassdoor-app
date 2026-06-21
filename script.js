// ==========================================================================
// STATE MANAGEMENT & CONSTANTS
// ==========================================================================
let allCompanies = [];
let filteredCompaniesA = [];
let filteredCompaniesB = [];

let isCompareMode = false;
let selectedCompanyA = null;
let selectedCompanyB = null;
let companySummaryA = null;
let companySummaryB = null;

// Chart instances for recycling
let sentimentChartA = null;
let sentimentChartB = null;
let categoryChart = null;
let predictionChart = null;

const SUGGESTED_COMPANIES = ["IBM", "Microsoft", "Apple", "Deloitte", "Oracle"];

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
// Header & Navigation controls
const compareModeToggle = document.getElementById("compare-mode-toggle");
const compareBtnText = document.getElementById("compare-btn-text");
const searchWrapperA = document.getElementById("search-wrapper-a");
const searchWrapperB = document.getElementById("search-wrapper-b");
const searchInputA = document.getElementById("company-search-input-a");
const searchInputB = document.getElementById("company-search-input-b");
const clearSearchBtnA = document.getElementById("clear-search-btn-a");
const clearSearchBtnB = document.getElementById("clear-search-btn-b");
const autocompleteListA = document.getElementById("autocomplete-list-a");
const autocompleteListB = document.getElementById("autocomplete-list-b");

const welcomeSection = document.getElementById("welcome-section");
const welcomeDescription = document.getElementById("welcome-description");
const dashboardSection = document.getElementById("dashboard-section");
const suggestedTagsContainer = document.getElementById("suggested-tags-container");
const recentSearchesBox = document.getElementById("recent-searches-box");
const recentTagsContainer = document.getElementById("recent-tags-container");

// Dashboard headers
const singleCompanyHeader = document.getElementById("single-company-header");
const comparisonCompanyHeader = document.getElementById("comparison-company-header");

// Single View headers
const companyTitleA = document.getElementById("company-title-a");
const reviewCountBadgeA = document.getElementById("review-count-badge-a");
const keywordsContainerA = document.getElementById("keywords-container-a");

// Compare View headers
const companyTitleCompA = document.getElementById("company-title-comp-a");
const reviewCountBadgeCompA = document.getElementById("review-count-badge-comp-a");
const keywordsContainerCompA = document.getElementById("keywords-container-comp-a");
const companyTitleCompB = document.getElementById("company-title-comp-b");
const reviewCountBadgeCompB = document.getElementById("review-count-badge-comp-b");
const keywordsContainerCompB = document.getElementById("keywords-container-comp-b");

// Dashboard columns and feedback cards
const dashboardColA = document.getElementById("dashboard-col-a");
const dashboardColB = document.getElementById("dashboard-col-b");
const ratingNumberA = document.getElementById("rating-number-a");
const ratingNumberB = document.getElementById("rating-number-b");
const ratingStarsContainerA = document.getElementById("rating-stars-container-a");
const ratingStarsContainerB = document.getElementById("rating-stars-container-b");

const feedbackCardA = document.getElementById("feedback-card-a");
const feedbackCardB = document.getElementById("feedback-card-b");
const feedbackTitleA = document.getElementById("feedback-title-a");
const feedbackTitleB = document.getElementById("feedback-title-b");
const prosListContainerA = document.getElementById("pros-list-container-a");
const consListContainerA = document.getElementById("cons-list-container-a");
const prosListContainerB = document.getElementById("pros-list-container-b");
const consListContainerB = document.getElementById("cons-list-container-b");

// Sandbox elements
const predictorForm = document.getElementById("predictor-form");
const sandboxPros = document.getElementById("sandbox-pros");
const sandboxCons = document.getElementById("sandbox-cons");
const analyzeBtn = document.getElementById("analyze-btn");
const btnText = document.getElementById("btn-text");
const btnLoader = document.getElementById("btn-loader");
const predictionResultWrapper = document.getElementById("prediction-result-wrapper");
const predictedLabelText = document.getElementById("predicted-label-text");
const xaiProsHighlighted = document.getElementById("xai-pros-highlighted");
const xaiConsHighlighted = document.getElementById("xai-cons-highlighted");

// Keyboard navigation active indices
let activeDropdownIndexA = -1;
let activeDropdownIndexB = -1;

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  // Initialize Lucide Icons
  lucide.createIcons();
  
  // Render quick tags & searches
  renderSuggestedTags();
  renderRecentSearches();
  
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

async function fetchCompanySummary(companyName, isCompanyA = true) {
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
    
    if (isCompanyA) {
      companySummaryA = summary;
      saveSearchHistory(summary.firm);
    } else {
      companySummaryB = summary;
      saveSearchHistory(summary.firm);
    }
    
    renderDashboard();
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
    renderPredictionResult(result, prosText, consText);
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
  // Toggle Compare Mode
  compareModeToggle.addEventListener("click", () => {
    toggleCompareMode();
  });

  // Search Box A input
  searchInputA.addEventListener("input", (e) => {
    const query = e.target.value.trim();
    if (query.length > 0) {
      clearSearchBtnA.style.display = "flex";
      filterCompaniesListA(query);
    } else {
      clearSearchBtnA.style.display = "none";
      hideDropdownA();
    }
  });

  // Clear Search Box A
  clearSearchBtnA.addEventListener("click", () => {
    searchInputA.value = "";
    clearSearchBtnA.style.display = "none";
    hideDropdownA();
    selectedCompanyA = null;
    companySummaryA = null;
    renderDashboard();
    searchInputA.focus();
  });

  // Search Box B input
  searchInputB.addEventListener("input", (e) => {
    const query = e.target.value.trim();
    if (query.length > 0) {
      clearSearchBtnB.style.display = "flex";
      filterCompaniesListB(query);
    } else {
      clearSearchBtnB.style.display = "none";
      hideDropdownB();
    }
  });

  // Clear Search Box B
  clearSearchBtnB.addEventListener("click", () => {
    searchInputB.value = "";
    clearSearchBtnB.style.display = "none";
    hideDropdownB();
    selectedCompanyB = null;
    companySummaryB = null;
    renderDashboard();
    searchInputB.focus();
  });

  // Close dropdowns on click outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#search-wrapper-a")) hideDropdownA();
    if (!e.target.closest("#search-wrapper-b")) hideDropdownB();
  });

  // Key navigation in A autocomplete list
  searchInputA.addEventListener("keydown", (e) => {
    const items = autocompleteListA.getElementsByClassName("autocomplete-item");
    if (autocompleteListA.style.display === "none" || items.length === 0) return;
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeDropdownIndexA = (activeDropdownIndexA + 1) % items.length;
      highlightDropdownItem(items, activeDropdownIndexA);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeDropdownIndexA = (activeDropdownIndexA - 1 + items.length) % items.length;
      highlightDropdownItem(items, activeDropdownIndexA);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeDropdownIndexA > -1 && items[activeDropdownIndexA]) {
        items[activeDropdownIndexA].click();
      } else if (filteredCompaniesA.length > 0) {
        selectCompanyItemA(filteredCompaniesA[0]);
      }
    } else if (e.key === "Escape") {
      hideDropdownA();
    }
  });

  // Key navigation in B autocomplete list
  searchInputB.addEventListener("keydown", (e) => {
    const items = autocompleteListB.getElementsByClassName("autocomplete-item");
    if (autocompleteListB.style.display === "none" || items.length === 0) return;
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeDropdownIndexB = (activeDropdownIndexB + 1) % items.length;
      highlightDropdownItem(items, activeDropdownIndexB);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeDropdownIndexB = (activeDropdownIndexB - 1 + items.length) % items.length;
      highlightDropdownItem(items, activeDropdownIndexB);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeDropdownIndexB > -1 && items[activeDropdownIndexB]) {
        items[activeDropdownIndexB].click();
      } else if (filteredCompaniesB.length > 0) {
        selectCompanyItemB(filteredCompaniesB[0]);
      }
    } else if (e.key === "Escape") {
      hideDropdownB();
    }
  });

  // Predictor form submission
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

  // Review collapsible section togglers
  const toggleA = document.getElementById("feedback-toggle-a");
  const toggleB = document.getElementById("feedback-toggle-b");
  if (toggleA) {
    toggleA.addEventListener("click", () => toggleReviewSection("a"));
  }
  if (toggleB) {
    toggleB.addEventListener("click", () => toggleReviewSection("b"));
  }
}

function toggleReviewSection(suffix) {
  const card = document.getElementById(`feedback-card-${suffix}`);
  const label = document.getElementById(`toggle-label-${suffix}`);
  if (!card) return;
  
  const isCollapsed = card.classList.contains("collapsed");
  if (isCollapsed) {
    card.classList.remove("collapsed");
    if (label) label.innerText = "Hide Reviews";
  } else {
    card.classList.add("collapsed");
    if (label) label.innerText = "Show Reviews";
  }
}

// ==========================================================================
// SEARCH & AUTOCOMPLETE UI LOGIC
// ==========================================================================
function filterCompaniesListA(query) {
  filteredCompaniesA = allCompanies.filter(comp => 
    comp.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10);
  renderAutocompleteDropdownA();
}

function filterCompaniesListB(query) {
  filteredCompaniesB = allCompanies.filter(comp => 
    comp.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10);
  renderAutocompleteDropdownB();
}

function renderAutocompleteDropdownA() {
  autocompleteListA.innerHTML = "";
  activeDropdownIndexA = -1;
  
  if (filteredCompaniesA.length === 0) {
    const noMatch = document.createElement("div");
    noMatch.className = "autocomplete-no-match";
    noMatch.innerText = "No matching companies";
    autocompleteListA.appendChild(noMatch);
  } else {
    filteredCompaniesA.forEach((company) => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";
      item.innerHTML = `<span>${company}</span><i data-lucide="chevron-right" style="width:14px;height:14px;opacity:0.6;"></i>`;
      item.addEventListener("click", () => {
        selectCompanyItemA(company);
      });
      autocompleteListA.appendChild(item);
    });
    lucide.createIcons();
  }
  autocompleteListA.style.display = "block";
}

function renderAutocompleteDropdownB() {
  autocompleteListB.innerHTML = "";
  activeDropdownIndexB = -1;
  
  if (filteredCompaniesB.length === 0) {
    const noMatch = document.createElement("div");
    noMatch.className = "autocomplete-no-match";
    noMatch.innerText = "No matching companies";
    autocompleteListB.appendChild(noMatch);
  } else {
    filteredCompaniesB.forEach((company) => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";
      item.innerHTML = `<span>${company}</span><i data-lucide="chevron-right" style="width:14px;height:14px;opacity:0.6;"></i>`;
      item.addEventListener("click", () => {
        selectCompanyItemB(company);
      });
      autocompleteListB.appendChild(item);
    });
    lucide.createIcons();
  }
  autocompleteListB.style.display = "block";
}

function highlightDropdownItem(items, activeIndex) {
  Array.from(items).forEach(item => item.classList.remove("selected"));
  if (activeIndex > -1 && items[activeIndex]) {
    items[activeIndex].classList.add("selected");
    items[activeIndex].scrollIntoView({ block: "nearest" });
  }
}

function hideDropdownA() {
  autocompleteListA.style.display = "none";
  activeDropdownIndexA = -1;
}

function hideDropdownB() {
  autocompleteListB.style.display = "none";
  activeDropdownIndexB = -1;
}

function selectCompanyItemA(companyName) {
  searchInputA.value = companyName;
  clearSearchBtnA.style.display = "flex";
  hideDropdownA();
  selectedCompanyA = companyName;
  fetchCompanySummary(companyName, true);
}

function selectCompanyItemB(companyName) {
  searchInputB.value = companyName;
  clearSearchBtnB.style.display = "flex";
  hideDropdownB();
  selectedCompanyB = companyName;
  fetchCompanySummary(companyName, false);
}

function renderSuggestedTags() {
  suggestedTagsContainer.innerHTML = "";
  SUGGESTED_COMPANIES.forEach(comp => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-btn";
    btn.innerText = comp;
    btn.addEventListener("click", () => {
      if (isCompareMode) {
        if (!selectedCompanyA) {
          selectCompanyItemA(comp);
        } else {
          selectCompanyItemB(comp);
        }
      } else {
        selectCompanyItemA(comp);
      }
    });
    suggestedTagsContainer.appendChild(btn);
  });
}

// ==========================================================================
// COMPARE MODE TOGGLE
// ==========================================================================
function toggleCompareMode() {
  isCompareMode = !isCompareMode;
  
  if (isCompareMode) {
    document.body.classList.add("compare-active");
    compareBtnText.innerText = "Single View";
    searchWrapperB.style.display = "block";
    welcomeDescription.innerText = "Search for two companies in the search bars above to visually compare reviews, ratings, and employee sentiments side-by-side.";
    
    // If Company A is loaded, transfer text
    if (selectedCompanyA) {
      searchInputA.value = selectedCompanyA;
      clearSearchBtnA.style.display = "flex";
    }
    
    // Show B elements in grid
    dashboardColB.style.display = "block";
    feedbackCardB.style.display = "block";
  } else {
    document.body.classList.remove("compare-active");
    compareBtnText.innerText = "Compare Mode";
    searchWrapperB.style.display = "none";
    welcomeDescription.innerText = "Type a company name in the search bar above to see its ratings, sentiment analysis, category breakdowns, and real pros vs cons.";
    
    // Hide B elements in grid
    dashboardColB.style.display = "none";
    feedbackCardB.style.display = "none";
  }
  
  renderDashboard();
}

// ==========================================================================
// RECENT SEARCHES HISTORY
// ==========================================================================
function saveSearchHistory(companyName) {
  let history = JSON.parse(localStorage.getItem("search_history")) || [];
  history = history.filter(c => c.toLowerCase() !== companyName.toLowerCase());
  history.unshift(companyName);
  history = history.slice(0, 5); // top 5
  localStorage.setItem("search_history", JSON.stringify(history));
  renderRecentSearches();
}

function renderRecentSearches() {
  const history = JSON.parse(localStorage.getItem("search_history")) || [];
  if (history.length === 0) {
    recentSearchesBox.style.display = "none";
    return;
  }
  recentSearchesBox.style.display = "flex";
  recentTagsContainer.innerHTML = "";
  
  history.forEach(company => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-btn";
    btn.innerText = company;
    btn.addEventListener("click", () => {
      if (isCompareMode) {
        if (!selectedCompanyA) {
          selectCompanyItemA(company);
        } else {
          selectCompanyItemB(company);
        }
      } else {
        selectCompanyItemA(company);
      }
    });
    recentTagsContainer.appendChild(btn);
  });
}

// ==========================================================================
// LOGO & AVATAR GENERATION
// ==========================================================================
function renderCompanyLogo(container, companyName) {
  container.innerHTML = "";
  container.className = "company-logo-avatar"; // reset fallbacks
  
  const knownDomains = {
    'ibm': 'ibm.com',
    'mcdonalds': 'mcdonalds.com',
    'deloitte': 'deloitte.com',
    'ey': 'ey.com',
    'pwc': 'pwc.com',
    'oracle': 'oracle.com',
    'microsoft': 'microsoft.com',
    'jpmorgan': 'jpmorgan.com',
    'kpmg': 'kpmg.com',
    'apple': 'apple.com',
    'google': 'google.com',
    'amazon': 'amazon.com',
    'facebook': 'meta.com',
    'accenture': 'accenture.com',
    
    // Detailed database mappings for high fidelity official logos
    'studentloanscompany': 'slc.co.uk',
    'pizzahut': 'pizzahut.com',
    'citi': 'citi.com',
    'hsbcholdings': 'hsbc.com',
    'bt': 'bt.com',
    'americanexpress': 'americanexpress.com',
    'squareenix': 'square-enix.com',
    'sky': 'sky.com',
    'primark': 'primark.com',
    'debenhams': 'debenhams.com',
    'bloomberglp': 'bloomberg.com',
    'goldmansachs': 'goldmansachs.com',
    'marriottinternational': 'marriott.com',
    'thomsonreuters': 'thomsonreuters.com',
    'willistowerswatson': 'wtwco.com',
    'capita': 'capita.com',
    'universityofmichigan': 'umich.edu',
    'britishairways': 'britishairways.com',
    'tesco': 'tesco.com',
    'workday': 'workday.com',
    'kornferry': 'kornferry.com',
    'handm': 'hm.com',
    'thomascook': 'thomascook.com',
    'sodexo': 'sodexo.com',
    'barclays': 'barclays.com',
    'deutschebank': 'db.com',
    'bbc': 'bbc.co.uk',
    'unitytechnologies': 'unity.com',
    'postoffice': 'postoffice.co.uk',
    'lloydsbankinggroup': 'lloydsbankinggroup.com',
    'morganstanley': 'morganstanley.com',
    'hilton': 'hilton.com',
    'salesforce': 'salesforce.com',
    'asda': 'asda.com',
    'morrisons': 'morrisons.com',
    'grantthorntonukllp': 'grantthornton.co.uk',
    'astrazeneca': 'astrazeneca.com',
    'adecco': 'adecco.com',
    'mckinseyandcompany': 'mckinsey.com',
    'cbre': 'cbre.com',
    'sap': 'sap.com',
    'santander': 'santander.co.uk',
    'bayer': 'bayer.com',
    'bostonconsultinggroup': 'bcg.com',
    'thelegogroup': 'lego.com',
    'cushmanandwakefield': 'cushmanwakefield.com',
    'glaxosmithkline': 'gsk.com',
    'unilever': 'unilever.com',
    'bookingcom': 'booking.com',
    'burberry': 'burberry.com',
    'linkedin': 'linkedin.com',
    'bainandcompany': 'bain.com',
    'axauk': 'axa.co.uk',
    'freshfieldsbruckhausderinger': 'freshfields.com',
    'metrobank': 'metrobankonline.co.uk',
    'knightfrank': 'knightfrank.com',
    'premierinn': 'premierinn.com',
    'lgtgroup': 'lgt.com',
    'ibis': 'ibis.com',
    'vmware': 'vmware.com',
    'jll': 'jll.co.uk'
  };
  
  let key = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  let domain = knownDomains[key] || (key + '.com');
  
  const img = document.createElement("img");
  img.src = `https://logo.clearbit.com/${domain}`;
  img.alt = `${companyName} logo`;
  let fallbackTried = false;
  img.onerror = () => {
    if (!fallbackTried) {
      fallbackTried = true;
      // Try Google Favicon API as a backup for official logo
      img.src = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
    } else {
      renderInitialsFallback(container, companyName);
    }
  };
  container.appendChild(img);
}

function renderInitialsFallback(container, companyName) {
  container.innerHTML = "";
  container.classList.add("avatar-fallback");
  
  // Dynamic consistent background color hashing
  let hash = 0;
  for (let i = 0; i < companyName.length; i++) {
    hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
  }
  let h = Math.abs(hash % 360);
  container.style.background = `linear-gradient(135deg, hsl(${h}, 70%, 45%) 0%, hsl(${(h + 40) % 360}, 75%, 32%) 100%)`;
  
  let initials = companyName.split('-').map(w => w[0]).join('').slice(0, 2);
  if (initials.length === 1) initials = companyName.slice(0, 2);
  container.innerText = initials;
}

// ==========================================================================
// RENDER DYNAMIC KEYWORD TOPIC TAG PILLS
// ==========================================================================
function renderKeywordPills(container, summary) {
  container.innerHTML = "";
  
  if (summary.pros_keywords && summary.pros_keywords.length > 0) {
    summary.pros_keywords.forEach(word => {
      const pill = document.createElement("span");
      pill.className = "keyword-pill keyword-pos";
      pill.innerText = `+ ${capitalizeFirstLetter(word)}`;
      container.appendChild(pill);
    });
  }
  
  if (summary.cons_keywords && summary.cons_keywords.length > 0) {
    summary.cons_keywords.forEach(word => {
      const pill = document.createElement("span");
      pill.className = "keyword-pill keyword-neg";
      pill.innerText = `- ${capitalizeFirstLetter(word)}`;
      container.appendChild(pill);
    });
  }
  
  if ((!summary.pros_keywords || summary.pros_keywords.length === 0) &&
      (!summary.cons_keywords || summary.cons_keywords.length === 0)) {
    container.innerHTML = `<span style="font-size:0.85rem;color:var(--text-muted);">None extracted</span>`;
  }
}

// ==========================================================================
// RENDERING DASHBOARD
// ==========================================================================
function renderDashboard() {
  const loadedA = companySummaryA !== null;
  const loadedB = companySummaryB !== null;
  
  // Decide what states to show
  if (!loadedA && !loadedB) {
    welcomeSection.style.display = "flex";
    dashboardSection.style.display = "none";
    return;
  }
  
  welcomeSection.style.display = "none";
  dashboardSection.style.display = "block";
  
  if (isCompareMode) {
    singleCompanyHeader.style.display = "none";
    comparisonCompanyHeader.style.display = "grid";
    
    // Header Column A
    if (loadedA) {
      companyTitleCompA.innerText = companySummaryA.firm;
      reviewCountBadgeCompA.innerText = `Based on ${companySummaryA.review_count} reviews`;
      renderCompanyLogo(document.getElementById("company-logo-container-comp-a"), companySummaryA.firm);
      renderKeywordPills(keywordsContainerCompA, companySummaryA);
      
      // Column A Content
      renderCompanyColumnContent(companySummaryA, "a");
    } else {
      companyTitleCompA.innerText = "Select Company A";
      reviewCountBadgeCompA.innerText = "Awaiting search...";
      document.getElementById("company-logo-container-comp-a").innerHTML = `<i data-lucide="help-circle" style="color:var(--text-muted);width:32px;height:32px;"></i>`;
      keywordsContainerCompA.innerHTML = "";
      clearColumnContent("a");
    }
    
    // Header Column B
    if (loadedB) {
      companyTitleCompB.innerText = companySummaryB.firm;
      reviewCountBadgeCompB.innerText = `Based on ${companySummaryB.review_count} reviews`;
      renderCompanyLogo(document.getElementById("company-logo-container-comp-b"), companySummaryB.firm);
      renderKeywordPills(keywordsContainerCompB, companySummaryB);
      
      // Column B Content
      renderCompanyColumnContent(companySummaryB, "b");
    } else {
      companyTitleCompB.innerText = "Select Company B";
      reviewCountBadgeCompB.innerText = "Awaiting search...";
      document.getElementById("company-logo-container-comp-b").innerHTML = `<i data-lucide="help-circle" style="color:var(--text-muted);width:32px;height:32px;"></i>`;
      keywordsContainerCompB.innerHTML = "";
      clearColumnContent("b");
    }
    
    lucide.createIcons();
    
    // Category Unified Compare Radar Chart
    updateCategoryRadarChart(
      loadedA ? companySummaryA.sub_ratings : null,
      loadedB ? companySummaryB.sub_ratings : null
    );
  } else {
    // Single View
    singleCompanyHeader.style.display = "block";
    comparisonCompanyHeader.style.display = "none";
    
    if (loadedA) {
      companyTitleA.innerText = companySummaryA.firm;
      reviewCountBadgeA.innerText = `Based on ${companySummaryA.review_count} reviews`;
      renderCompanyLogo(document.getElementById("company-logo-container-a"), companySummaryA.firm);
      renderKeywordPills(keywordsContainerA, companySummaryA);
      
      renderCompanyColumnContent(companySummaryA, "a");
      updateCategoryRadarChart(companySummaryA.sub_ratings, null);
    } else if (loadedB) {
      // Fallback in case they exited compare mode and only B was loaded
      companySummaryA = companySummaryB;
      companySummaryB = null;
      selectedCompanyA = selectedCompanyB;
      selectedCompanyB = null;
      searchInputA.value = selectedCompanyA;
      clearSearchBtnA.style.display = "flex";
      searchInputB.value = "";
      clearSearchBtnB.style.display = "none";
      
      companyTitleA.innerText = companySummaryA.firm;
      reviewCountBadgeA.innerText = `Based on ${companySummaryA.review_count} reviews`;
      renderCompanyLogo(document.getElementById("company-logo-container-a"), companySummaryA.firm);
      renderKeywordPills(keywordsContainerA, companySummaryA);
      
      renderCompanyColumnContent(companySummaryA, "a");
      updateCategoryRadarChart(companySummaryA.sub_ratings, null);
    }
  }
}

function renderCompanyColumnContent(summary, suffix) {
  const ratingNumEl = document.getElementById(`rating-number-${suffix}`);
  const footerEl = document.getElementById(`rating-footer-${suffix}`);
  const starsContainer = document.getElementById(`rating-stars-container-${suffix}`);
  const prosContainer = document.getElementById(`pros-list-container-${suffix}`);
  const consContainer = document.getElementById(`cons-list-container-${suffix}`);
  const feedbackTitleEl = document.getElementById(`feedback-title-${suffix}`);
  
  // Collapse reviews by default on data load
  const cardEl = document.getElementById(`feedback-card-${suffix}`);
  if (cardEl) {
    cardEl.classList.add("collapsed");
  }
  const labelEl = document.getElementById(`toggle-label-${suffix}`);
  if (labelEl) {
    labelEl.innerText = "Show Reviews";
  }
  
  ratingNumEl.innerText = summary.overall_rating.toFixed(1);
  footerEl.innerText = `Average score of ${summary.review_count} employees`;
  feedbackTitleEl.innerHTML = `<i data-lucide="message-square"></i> feedback on ${summary.firm}`;
  
  // Render Stars
  renderStars(starsContainer, summary.overall_rating);
  
  // Render Pros
  prosContainer.innerHTML = "";
  if (summary.pros_list && summary.pros_list.length > 0) {
    summary.pros_list.forEach(p => {
      const li = document.createElement("li");
      li.innerText = capitalizeFirstLetter(p);
      prosContainer.appendChild(li);
    });
  } else {
    prosContainer.innerHTML = "<li>No pros recorded</li>";
  }
  
  // Render Cons
  consContainer.innerHTML = "";
  if (summary.cons_list && summary.cons_list.length > 0) {
    summary.cons_list.forEach(c => {
      const li = document.createElement("li");
      li.innerText = capitalizeFirstLetter(c);
      consContainer.appendChild(li);
    });
  } else {
    consContainer.innerHTML = "<li>No cons recorded</li>";
  }
  
  // Render Pie Chart
  updateSentimentDonutChart(summary.sentiment_pct, suffix);
}

function clearColumnContent(suffix) {
  document.getElementById(`rating-number-${suffix}`).innerText = "0.0";
  document.getElementById(`rating-stars-container-${suffix}`).innerHTML = "";
  document.getElementById(`pros-list-container-${suffix}`).innerHTML = "";
  document.getElementById(`cons-list-container-${suffix}`).innerHTML = "";
  
  const chartEl = document.querySelector(`#sentiment-pie-chart-${suffix}`);
  chartEl.innerHTML = `<div style="color:var(--text-muted);font-size:0.9rem;">No data</div>`;
}

function renderStars(container, rating) {
  container.innerHTML = "";
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  
  for (let i = 0; i < fullStars; i++) {
    const star = document.createElement("i");
    star.setAttribute("data-lucide", "star");
    star.className = "filled";
    container.appendChild(star);
  }
  
  if (hasHalf) {
    const star = document.createElement("i");
    star.setAttribute("data-lucide", "star-half");
    star.className = "filled";
    container.appendChild(star);
  }
  
  for (let i = 0; i < emptyStars; i++) {
    const star = document.createElement("i");
    star.setAttribute("data-lucide", "star");
    container.appendChild(star);
  }
  
  lucide.createIcons({ nameAttr: 'data-lucide' });
}

function updateSentimentDonutChart(pctData, suffix) {
  const positive = pctData.Positive || 0.0;
  const neutral = pctData.Neutral || 0.0;
  const negative = pctData.Negative || 0.0;
  
  const chartOptions = {
    series: [positive, neutral, negative],
    labels: ['Positive', 'Neutral', 'Negative'],
    chart: {
      type: 'donut',
      height: 220,
      background: 'transparent',
      animations: { enabled: true, speed: 600 }
    },
    colors: ['#10b981', '#f59e0b', '#f43f5e'],
    legend: { show: false }, // hide legends for clean side-by-side views
    stroke: { show: false },
    dataLabels: {
      enabled: true,
      style: { fontSize: '11px', fontFamily: 'Inter' },
      formatter: (val) => `${val.toFixed(0)}%`
    },
    plotOptions: {
      pie: {
        donut: {
          size: '62%',
          labels: {
            show: true,
            name: { show: true, fontSize: '12px', color: '#9ca3af', fontFamily: 'Plus Jakarta Sans' },
            value: { 
              show: true, 
              color: '#f3f4f6', 
              fontSize: '18px', 
              fontWeight: '800',
              fontFamily: 'Plus Jakarta Sans',
              formatter: (val) => `${val}%`
            },
            total: {
              show: true,
              label: 'Positive',
              color: '#10b981',
              fontSize: '11px',
              fontFamily: 'Plus Jakarta Sans',
              formatter: () => `${positive}%`
            }
          }
        }
      }
    },
    theme: { mode: 'dark' },
    tooltip: {
      y: { formatter: (val) => `${val}%` }
    }
  };
  
  if (suffix === "a") {
    if (sentimentChartA) sentimentChartA.destroy();
    sentimentChartA = new ApexCharts(document.querySelector("#sentiment-pie-chart-a"), chartOptions);
    sentimentChartA.render();
  } else {
    if (sentimentChartB) sentimentChartB.destroy();
    sentimentChartB = new ApexCharts(document.querySelector("#sentiment-pie-chart-b"), chartOptions);
    sentimentChartB.render();
  }
}

function updateCategoryRadarChart(subRatingsA, subRatingsB = null) {
  const categories = subRatingsA ? Object.keys(subRatingsA) : ['Work-Life Balance', 'Culture & Values', 'Diversity & Inclusion', 'Career Opportunities', 'Compensation & Benefits', 'Senior Management'];
  const valuesA = subRatingsA ? Object.values(subRatingsA) : [0, 0, 0, 0, 0, 0];
  
  const series = [{
    name: selectedCompanyA || 'Company A',
    data: valuesA
  }];
  
  if (isCompareMode && subRatingsB) {
    series.push({
      name: selectedCompanyB || 'Company B',
      data: Object.values(subRatingsB)
    });
  }
  
  // Map category names to multiline arrays to prevent label clipping on the sides
  const categoryLabels = {
    'Work-Life Balance': ['Work-Life', 'Balance'],
    'Culture & Values': ['Culture &', 'Values'],
    'Diversity & Inclusion': ['Diversity &', 'Inclusion'],
    'Career Opportunities': ['Career', 'Opportunities'],
    'Compensation & Benefits': ['Compensation', '& Benefits'],
    'Senior Management': ['Senior', 'Management']
  };
  const displayCategories = categories.map(cat => categoryLabels[cat] || cat);
  
  const chartOptions = {
    series: series,
    chart: {
      type: 'radar',
      height: 310,
      background: 'transparent',
      toolbar: { show: false }
    },
    plotOptions: {
      radar: {
        size: 75 // Reduce radar radius slightly to give labels extra breathing room
      }
    },
    grid: {
      padding: {
        left: 35,
        right: 35,
        top: 15,
        bottom: 15
      }
    },
    stroke: { width: 2 },
    fill: { opacity: 0.15 },
    markers: { size: 3 },
    colors: isCompareMode ? ['#6366f1', '#a855f7'] : ['#6366f1'],
    xaxis: {
      categories: displayCategories,
      labels: {
        style: {
          colors: Array(6).fill('#9ca3af'),
          fontSize: '11px',
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: 500
        }
      }
    },
    yaxis: {
      show: false,
      min: 0,
      max: 5
    },
    legend: {
      show: isCompareMode,
      position: 'bottom',
      labels: { colors: '#9ca3af' },
      fontFamily: 'Inter'
    },
    theme: { mode: 'dark' }
  };
  
  if (categoryChart) {
    categoryChart.destroy();
  }
  
  categoryChart = new ApexCharts(document.querySelector("#category-radar-chart"), chartOptions);
  categoryChart.render();
}

// ==========================================================================
// PREDICTIVE MODEL & EXPLAINABLE AI (XAI) UI LOGIC
// ==========================================================================
function renderPredictionResult(result, rawPros, rawCons) {
  predictedLabelText.className = "";
  predictedLabelText.classList.add(`predicted-${result.sentiment}`);
  predictedLabelText.innerText = result.sentiment;
  
  // Show wrapper
  predictionResultWrapper.style.display = "block";
  
  // Render Confidence distribution
  updatePredictionChart(result.probabilities || {});
  
  // Render XAI Word highlights
  const highlightedPros = highlightTextXAI(rawPros, result.pros_weights || {});
  const highlightedCons = highlightTextXAI(rawCons, result.cons_weights || {});
  
  xaiProsHighlighted.innerHTML = highlightedPros;
  xaiConsHighlighted.innerHTML = highlightedCons;
  
  predictionResultWrapper.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function highlightTextXAI(rawText, weights) {
  if (!rawText.trim()) return "<em>No text provided</em>";
  
  // Tokenize text keeping spaces and punctuation
  const tokens = rawText.split(/(\s+|[.,!?;:()"])/);
  
  const highlightedTokens = tokens.map(token => {
    // Clean to match backend vocabulary
    const clean = token.toLowerCase().replace(/[^a-z]/g, '');
    if (!clean) return token;
    
    const w = weights[clean];
    if (w !== undefined) {
      if (w > 0.08) {
        return `<span class="highlight-word-pos" title="Weight: +${w.toFixed(3)}">${token}</span>`;
      } else if (w < -0.08) {
        return `<span class="highlight-word-neg" title="Weight: ${w.toFixed(3)}">${token}</span>`;
      }
    }
    return token;
  });
  
  return highlightedTokens.join('');
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
      height: 160,
      toolbar: { show: false },
      background: 'transparent'
    },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '45%',
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
      formatter: (val) => `${val.toFixed(0)}%`,
      style: { fontFamily: 'Inter', fontSize: '10px' }
    },
    xaxis: {
      categories: categories,
      labels: { style: { colors: '#9ca3af', fontFamily: 'Inter' } },
      min: 0,
      max: 100
    },
    yaxis: {
      labels: { style: { colors: '#f3f4f6', fontFamily: 'Plus Jakarta Sans', fontWeight: 600 } }
    },
    grid: { borderColor: 'rgba(255, 255, 255, 0.05)' },
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

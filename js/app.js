// app.js — Main initialization and event wiring

document.addEventListener('DOMContentLoaded', async () => {
  // Wire mobile nav hamburger
  const navScroll = document.getElementById('navScroll');
  const navOverlay = document.getElementById('navOverlay');
  const navHamburger = document.getElementById('navHamburger');

  function closeMobileNav() {
    navScroll.classList.remove('open');
    navOverlay.classList.remove('open');
  }

  navHamburger.addEventListener('click', () => {
    navScroll.classList.toggle('open');
    navOverlay.classList.toggle('open');
  });

  navOverlay.addEventListener('click', closeMobileNav);

  // Wire toggle groups (pill-style toggles)
  document.querySelectorAll('.toggle-group').forEach(group => {
    group.querySelectorAll('.toggle-option').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.toggle-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        group.dataset.value = btn.dataset.val;
        renderCurrentSection();
      });
    });
  });

  // Wire navigation (always)
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      const sectionId = btn.dataset.section;
      document.getElementById(sectionId).classList.add('active');
      currentSection = sectionId;
      renderCurrentSection();
      closeMobileNav();
    });
  });

  // Wire filter changes
  document.getElementById('fyFilter').addEventListener('change', renderCurrentSection);
  document.getElementById('accountFilter').addEventListener('change', () => {
    selectedAccount = document.getElementById('accountFilter').value;
    populateFYFilter();
    renderCurrentSection();
  });

  // Wire add buttons
  document.getElementById('addForeignIncome').addEventListener('click', () => openModal('foreignIncome'));
  document.getElementById('addPropertyIncome').addEventListener('click', () => openModal('propertyIncome'));
  document.getElementById('addCapitalGains').addEventListener('click', () => openModal('capitalGains'));
  document.getElementById('addOtherIncome').addEventListener('click', () => openModal('otherIncome'));
  document.getElementById('addStockPurchase').addEventListener('click', () => openModal('stockPurchase'));
  document.getElementById('addStockSale').addEventListener('click', () => openModal('stockSale'));
  document.getElementById('addAdvanceTax').addEventListener('click', () => openModal('advanceTax'));

  // Wire modal
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalForm').addEventListener('submit', handleFormSubmit);

  // Wire add account
  document.getElementById('addAccountBtn').addEventListener('click', () => {
    openModal('account');
  });


  // Close modal on outside click
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal')) closeModal();
  });

  // ---- Load/Save workflow ----

  // Header Save button
  document.getElementById('saveDataBtn').addEventListener('click', saveDataToFile);

  // Header Reset button
  document.getElementById('resetBtn').addEventListener('click', () => {
    clearStorage();
    isDirty = false;
    dataLoaded = false;
    DB = { accounts: [], config: {} };
    selectedAccount = null;
    updateDataButtons();
    showLoadScreen();
  });

  // Load screen button
  document.getElementById('loadScreenBtn').addEventListener('click', () => {
    document.getElementById('loadScreenFileInput').click();
  });
  document.getElementById('loadScreenFileInput').addEventListener('change', (e) => {
    if (e.target.files[0]) {
      loadDataFromFile(e.target.files[0]).then(() => {
        populateFilters();
        renderCurrentSection();
        hideLoadScreen();
      });
      e.target.value = '';
    }
  });

  // Sample data button
  document.getElementById('loadSampleBtn').addEventListener('click', () => {
    fetch('data/sample.json')
      .then(r => r.json())
      .then(data => {
        DB = data;
        if (!DB.config) DB.config = {};
        saveToStorage();
        dataLoaded = true;
        isDirty = false;
        selectedAccount = DB.accounts.length > 0 ? DB.accounts[0].account : null;
        updateDataButtons();
        populateFilters();
        renderCurrentSection();
        hideLoadScreen();
      })
      .catch(() => alert('Could not load sample data.'));
  });


  // ---- Startup: check if data exists in localStorage ----
  if (hasStoredData()) {
    loadFromStorage();
    dataLoaded = true;
    isDirty = true; // unsaved session from before
    selectedAccount = DB.accounts.length > 0 ? DB.accounts[0].account : null;
    updateDataButtons();
    populateFilters();
    renderCurrentSection();
  } else {
    showLoadScreen();
    updateDataButtons();
  }
});

function showLoadScreen() {
  document.getElementById('loadScreen').classList.remove('hidden');
  document.querySelector('nav').classList.add('disabled');
  document.querySelector('main').classList.add('disabled');
}

function hideLoadScreen() {
  document.getElementById('loadScreen').classList.add('hidden');
  document.querySelector('nav').classList.remove('disabled');
  document.querySelector('main').classList.remove('disabled');
}

function populateFilters() {
  const accSelect = document.getElementById('accountFilter');

  // Accounts from data
  const accounts = getAccounts();
  accSelect.innerHTML = accounts.map(a => `<option value="${a}">${a}</option>`).join('');

  if (selectedAccount && accounts.includes(selectedAccount)) {
    accSelect.value = selectedAccount;
  } else if (accounts.length > 0) {
    selectedAccount = accounts[0];
    accSelect.value = selectedAccount;
  }

  populateFYFilter();
}

function populateFYFilter() {
  const fySelect = document.getElementById('fyFilter');
  const years = getFinancialYears();
  fySelect.innerHTML = '<option value="All">All Years</option>' +
    years.map(y => `<option value="${y}">${y}</option>`).join('');
  if (years.length > 0) fySelect.value = years[0];
}

// Main JavaScript file for SpendSight Application

document.addEventListener('DOMContentLoaded', function() {
  console.log('SpendSight application initialized');
  
  // Initialize tooltips and popovers if Bootstrap is loaded
  if (typeof bootstrap !== 'undefined') {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
      return new bootstrap.Popover(popoverTriggerEl);
    });
  }
  
  // Handle API test calls
  const apiTestButtons = document.querySelectorAll('.api-test-btn');
  apiTestButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const endpoint = this.dataset.endpoint;
      const method = this.dataset.method || 'GET';
      
      testApiEndpoint(endpoint, method);
    });
  });
  
  // Function to test API endpoints
  function testApiEndpoint(endpoint, method = 'GET') {
    const resultContainer = document.getElementById('api-test-result');
    if (!resultContainer) return;
    
    resultContainer.innerHTML = '<div class="alert alert-info">Testing API endpoint...</div>';
    
    fetch(endpoint, { method })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        resultContainer.innerHTML = `
          <div class="alert alert-success">
            <h5>Success!</h5>
            <pre class="mb-0">${JSON.stringify(data, null, 2)}</pre>
          </div>
        `;
      })
      .catch(error => {
        resultContainer.innerHTML = `
          <div class="alert alert-danger">
            <h5>Error</h5>
            <p>${error.message}</p>
          </div>
        `;
      });
  }
  
  // Format currency values
  const currencyElements = document.querySelectorAll('.currency');
  currencyElements.forEach(el => {
    const value = parseFloat(el.textContent);
    if (!isNaN(value)) {
      el.textContent = formatCurrency(value);
      
      // Add positive/negative class if needed
      if (value > 0) {
        el.classList.add('positive');
      } else if (value < 0) {
        el.classList.add('negative');
      }
    }
  });
  
  // Format currency function
  function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  }
  
  // Form validation for any forms with validation class
  const forms = document.querySelectorAll('.needs-validation');
  Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      
      form.classList.add('was-validated');
    }, false);
  });
}); 
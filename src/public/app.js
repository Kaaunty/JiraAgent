document.addEventListener("DOMContentLoaded", () => {
  // --- Element Selectors ---
  const step1 = document.getElementById("step-1");
  const step2 = document.getElementById("step-2");
  const step3 = document.getElementById("step-3");
  const loader = document.getElementById("loader");
  const loaderMessage = document.getElementById("loader-message");
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toast-message");

  // Step 1 Inputs
  const userText = document.getElementById("user-text");
  const btnAnalyze = document.getElementById("btn-analyze");

  // Step 2 Inputs
  const issueSummary = document.getElementById("issue-summary");
  // Labels are now auto-generated, display them here
  const generatedLabels = document.getElementById("generated-labels");

  const issueDescription = document.getElementById("issue-description");
  const descriptionPreview = document.getElementById("description-preview");
  const btnBack = document.getElementById("btn-back");
  const btnSubmit = document.getElementById("btn-submit");
  // Holds labels from analysis
  let analysisLabels = [];
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  // Custom dropdowns (only type and priority are needed)
  const selectType = document.getElementById("select-type");
  const selectPriority = document.getElementById("select-priority");
  // Allowed label values (must correspond to categories)
  const allowedLabels = [
    "frontend","backend","mobile","integração","banco de dados","infraestrutura","segurança",
    "ux/ui","performance","relatórios","automação","documentação","devops","dados","outros",
    "erp","fw","importacao","task"
  ];
  // Step 3 Outputs
  const successKey = document.getElementById("success-key");
  const successSummary = document.getElementById("success-summary");
  const successType = document.getElementById("success-type");
  const successPriority = document.getElementById("success-priority");
  const successLabels = document.getElementById("success-labels");
  const successLink = document.getElementById("success-link");
  const btnRestart = document.getElementById("btn-restart");

  // -------------------------------------------------------
  // Custom Select Logic
  // -------------------------------------------------------
  function initCustomSelects() {
    document.querySelectorAll(".custom-select").forEach(select => {
      const trigger = select.querySelector(".custom-select__trigger");
      const options = select.querySelectorAll(".custom-select__option");

      if (trigger) {
        trigger.addEventListener("click", (e) => {
          e.stopPropagation();
          // Close any other open selects
          document.querySelectorAll(".custom-select.open").forEach(other => {
            if (other !== select) other.classList.remove("open");
          });
          select.classList.toggle("open");
        });
      }

      options.forEach(option => {
        option.addEventListener("click", () => {
          const value = option.dataset.value;
          const label = option.textContent.trim();

          // Update data attribute and trigger label
          select.dataset.value = value;
          const labelEl = select.querySelector(".custom-select__label");
          if (labelEl) {
            labelEl.textContent = label;
          }

          // Update selected state on options
          options.forEach(o => o.classList.remove("selected"));
          option.classList.add("selected");

          select.classList.remove("open");
        });
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener("click", () => {
      document.querySelectorAll(".custom-select.open").forEach(s => s.classList.remove("open"));
    });
  }

  /**
   * Set the value of a custom select programmatically.
   * @param {HTMLElement} selectEl - The .custom-select element
   * @param {string} value - The data-value to select
   */
  function setCustomSelectValue(selectEl, value) {
    if (!selectEl) return;
    const option = selectEl.querySelector(`.custom-select__option[data-value="${value}"]`);
    if (!option) return;

    const label = option.textContent.trim();
    selectEl.dataset.value = value;
    const labelEl = selectEl.querySelector(".custom-select__label");
    if (labelEl) {
      labelEl.textContent = label;
    }

    selectEl.querySelectorAll(".custom-select__option").forEach(o => o.classList.remove("selected"));
    option.classList.add("selected");
  }

  /**
   * Get the current value of a custom select.
   * @param {HTMLElement} selectEl
   * @returns {string}
   */
  function getCustomSelectValue(selectEl) {
    return selectEl.dataset.value;
  }

  // Initialize all custom selects on load
  initCustomSelects();

  // -------------------------------------------------------
  // Helper Functions
  // -------------------------------------------------------
  function showLoader(message) {
    if (loaderMessage) loaderMessage.textContent = message;
    if (loader) loader.classList.add("active");
  }

  function hideLoader() {
    if (loader) loader.classList.remove("active");
  }

  function showToast(message) {
    if (toastMessage) toastMessage.textContent = message;
    if (toast) toast.classList.add("active");
    setTimeout(() => {
      if (toast) toast.classList.remove("active");
    }, 5000);
  }

  function transitionTo(step) {
    [step1, step2, step3].forEach(s => s.classList.remove("active"));
    step.classList.add("active");
  }

  // Simple Markdown Parser for Preview
  function parseMarkdown(md) {
    if (!md) return "<i>Nenhuma descrição informada.</i>";

    // Escape HTML to prevent XSS
    let html = md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Headers
    html = html.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.*?)$/gm, "<h1>$1</h1>");

    // Bold (**text**)
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Italic (*text*)
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Inline code (`code`)
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Checklist items
    html = html.replace(/^\s*-\s*\[\s*\]\s*(.*?)$/gm, '<div class="todo-item"><input type="checkbox" disabled> <span>$1</span></div>');
    html = html.replace(/^\s*-\s*\[\s*x\s*\]\s*(.*?)$/gm, '<div class="todo-item"><input type="checkbox" checked disabled> <span>$1</span></div>');

    // Bullet list items
    html = html.replace(/^\s*-\s*(?!\[)(.*?)$/gm, "<li>$1</li>");

    // Line breaks
    html = html.replace(/\n/g, "<br>");

    return html;
  }

  // -------------------------------------------------------
  // Event Listeners
  // -------------------------------------------------------

  // Step 1: Analyze text with AI
  btnAnalyze.addEventListener("click", async () => {
    if (!userText) return;
    const text = userText.value.trim();
    if (!text) {
      showToast("Por favor, digite alguma descrição antes de prosseguir.");
      return;
    }

    showLoader("O Agente está analisando e estruturando seu card...");

    try {
      const response = await fetch("/api/issue/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: text })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao analisar o texto.");
      }

      // Populate Step 2 fields with safety checks
      if (issueSummary) issueSummary.value = data.summary || "";
      if (selectType) setCustomSelectValue(selectType, "Task");
      if (selectPriority) setCustomSelectValue(selectPriority, data.priority || "Medium");
      // Category and Component are ignored in the new flow

      if (issueDescription) issueDescription.value = data.description || "";

      // Labels are no longer used; clear any stored labels
      analysisLabels = [];

      // Render Markdown preview
      if (descriptionPreview) descriptionPreview.innerHTML = parseMarkdown(data.description);

      transitionTo(step2);
    } catch (error) {
      console.error(error);
      showToast(error.message);
    } finally {
      hideLoader();
    }
  });

  // Step 2: Tab Navigation (Editor vs Preview)
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const targetTab = btn.getAttribute("data-tab");
      tabContents.forEach(content => {
        content.classList.remove("active");
        if (content.id === `tab-${targetTab}`) {
          content.classList.add("active");
        }
      });

      if (targetTab === "preview") {
        descriptionPreview.innerHTML = parseMarkdown(issueDescription.value);
      }
    });
  });

  // Step 2: Go back to Step 1
  btnBack.addEventListener("click", () => {
    transitionTo(step1);
  });

  // Step 2: Submit Card to Jira (category and component omitted, issueType forced to Task)
  btnSubmit.addEventListener("click", async () => {
    const summary = issueSummary.value.trim();
    const type = "Task"; // always Task
    const priority = getCustomSelectValue(selectPriority);
    const description = issueDescription.value.trim();

      // Prepare labels for submission (exclude redundant "task")
      // No labels are sent to Jira
      const labels = [];

    if (!summary) {
      showToast("O resumo do card é obrigatório.");
      return;
    }
    if (!description) {
      showToast("A descrição do card é obrigatória.");
      return;
    }

    showLoader("Enviando card para o Jira...");

    try {
      const response = await fetch("/api/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueType: type,
          summary: summary,
          priority: priority,
          labels: labels,
          description: description
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar a issue no Jira.");
      }

      // Populate Success Details
      successKey.textContent = data.jiraKey;
      successSummary.textContent = data.issue.summary;

      let typeIcon = "fa-circle-question";
      if (data.issue.issueType === "Bug") typeIcon = "fa-bug";
      else if (data.issue.issueType === "Story") typeIcon = "fa-book";
      else if (data.issue.issueType === "Task") typeIcon = "fa-screwdriver-wrench";
      else if (data.issue.issueType === "Improvement") typeIcon = "fa-chart-line";

      successType.innerHTML = `<i class="fa-solid ${typeIcon}"></i> ${data.issue.issueType}`;
      successPriority.innerHTML = `<i class="fa-solid fa-circle"></i> ${data.issue.priority}`;

      // Show generated labels (exclude redundant "Task" and capitalize)
      // Labels are omitted from success view
      successLabels.innerHTML = "";

      if (data.issueUrl) {
        successLink.href = data.issueUrl;
        successLink.style.display = "inline-flex";
      } else {
        successLink.style.display = "none";
      }

      transitionTo(step3);
    } catch (error) {
      console.error(error);
      showToast(error.message);
    } finally {
      hideLoader();
    }
  });

  // Step 3: Restart Flow
  if (btnRestart) {
    btnRestart.addEventListener("click", () => {
      if (userText) userText.value = "";
      setCustomSelectValue(selectType, "Task");
      setCustomSelectValue(selectPriority, "Medium");
      transitionTo(step1);
    });
  }
});

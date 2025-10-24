/* DOM references */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateBtn = document.getElementById("generateRoutine");
const clearBtn = document.getElementById("clearSelections");
const userInput = document.getElementById("userInput");

/* Initial placeholder */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* App state */
const state = {
  allProducts: [],
  selectedIds: new Set(
    JSON.parse(localStorage.getItem("selectedProductIds") || "[]")
  ),
  messages: [
    {
      role: "system",
      content:
        "You are a friendly, concise beauty advisor. Only discuss skincare, haircare, makeup, fragrance, and closely related routine questions. Decline unrelated topics. Use clear steps and reference provided products when possible.",
    },
  ],
  routineGenerated: false,
};

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Helper to get product by id */
function getProductById(id) {
  return state.allProducts.find((p) => p.id === Number(id));
}

/* Save selection to localStorage */
function persistSelection() {
  localStorage.setItem(
    "selectedProductIds",
    JSON.stringify([...state.selectedIds])
  );
}

/* Render selected products pills */
function renderSelectedProducts() {
  const items = [...state.selectedIds]
    .map((id) => getProductById(id))
    .filter(Boolean);

  if (items.length === 0) {
    selectedProductsList.innerHTML = `<div class="placeholder-message" style="padding:14px">No products selected yet.</div>`;
    return;
  }

  selectedProductsList.innerHTML = items
    .map(
      (p) => `
      <div class="pill" data-id="${p.id}">
        <span>${p.brand} — ${p.name}</span>
        <button class="remove-pill" aria-label="Remove ${p.name}" type="button">&times;</button>
      </div>
    `
    )
    .join("");
}

/* Create HTML for displaying product cards (includes Details toggle) */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = state.selectedIds.has(product.id);
      return `
        <div class="product-card ${isSelected ? "selected" : ""}" data-id="${
        product.id
      }">
          <img src="${product.image}" alt="${product.name}">
          <div class="product-info">
            <h3>${product.name}</h3>
            <p>${product.brand}</p>
            <button class="details-btn" type="button" aria-expanded="false">Details</button>
            <div class="product-desc" hidden>
              ${product.description}
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

/* Toggle selection on card click, and toggle description on Details */
productsContainer.addEventListener("click", (e) => {
  const detailsBtn = e.target.closest(".details-btn");
  if (detailsBtn) {
    const info = detailsBtn.closest(".product-info");
    const desc = info.querySelector(".product-desc");
    const expanded = detailsBtn.getAttribute("aria-expanded") === "true";
    detailsBtn.setAttribute("aria-expanded", String(!expanded));
    if (desc) desc.hidden = expanded;
    e.stopPropagation();
    return;
  }

  const card = e.target.closest(".product-card");
  if (!card) return;

  const id = Number(card.getAttribute("data-id"));
  if (state.selectedIds.has(id)) {
    state.selectedIds.delete(id);
    card.classList.remove("selected");
  } else {
    state.selectedIds.add(id);
    card.classList.add("selected");
  }
  persistSelection();
  renderSelectedProducts();
});

/* Remove from selected list */
selectedProductsList.addEventListener("click", (e) => {
  const btn = e.target.closest(".remove-pill");
  if (!btn) return;
  const pill = btn.closest(".pill");
  const id = Number(pill.getAttribute("data-id"));
  state.selectedIds.delete(id);
  persistSelection();
  renderSelectedProducts();

  /* Also un-highlight card if visible */
  const card = productsContainer.querySelector(
    `.product-card[data-id="${id}"]`
  );
  if (card) card.classList.remove("selected");
});

/* Clear all selections */
clearBtn.addEventListener("click", () => {
  if (state.selectedIds.size === 0) return;
  state.selectedIds.clear();
  persistSelection();
  renderSelectedProducts();
  /* Clear any visible highlights */
  productsContainer
    .querySelectorAll(".product-card.selected")
    .forEach((c) => c.classList.remove("selected"));
});

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const selectedCategory = e.target.value;
  const filteredProducts = state.allProducts.filter(
    (p) => p.category === selectedCategory
  );
  displayProducts(filteredProducts);
});

/* Append chat messages to window */
function appendMessage(role, text) {
  /* Remove placeholder if present */
  const ph = chatWindow.querySelector(".placeholder-message");
  if (ph) ph.remove();

  const container = document.createElement("div");
  container.className = `msg ${role === "user" ? "user" : "bot"}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  container.appendChild(bubble);
  chatWindow.appendChild(container);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Send messages to OpenAI via Cloudflare Worker (preferred) or direct as fallback */
async function askOpenAI(messages) {
  /* Prefer a Cloudflare Worker endpoint if provided in secrets.js */
  const endpoint =
    window.CFWORKER_URL || "https://api.openai.com/v1/chat/completions";
  const isWorker = Boolean(window.CFWORKER_URL);

  const headers = {
    "Content-Type": "application/json",
    ...(isWorker
      ? {}
      : {
          /* Fallback for local testing only. Do not ship API keys to production. */
          Authorization: `Bearer ${window.OPENAI_API_KEY || ""}`,
        }),
  };

  const body = JSON.stringify({
    model: "gpt-4o",
    messages,
  });

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body,
  });

  /* Expecting OpenAI-compatible response shape from Worker */
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in AI response.");
  }
  return content.trim();
}

/* Generate Routine button logic */
generateBtn.addEventListener("click", async () => {
  const selected = [...state.selectedIds]
    .map((id) => getProductById(id))
    .filter(Boolean);
  if (selected.length === 0) {
    appendMessage(
      "bot",
      "Please select at least one product to generate a routine."
    );
    return;
  }

  /* Create a simple JSON payload of selected products */
  const minimal = selected.map((p) => ({
    id: p.id,
    brand: p.brand,
    name: p.name,
    category: p.category,
    description: p.description,
  }));

  const userMsg = `Create a simple, step-by-step routine using ONLY the selected products below. Explain morning vs. night if relevant, and include brief how/why tips. Keep it concise and safe for beginners.\n\nSelected products (JSON):\n${JSON.stringify(
    minimal,
    null,
    2
  )}`;

  appendMessage(
    "user",
    "Generate a personalized routine with my selected products."
  );
  state.messages.push({ role: "user", content: userMsg });

  try {
    const reply = await askOpenAI(state.messages);
    state.messages.push({ role: "assistant", content: reply });
    state.routineGenerated = true;
    appendMessage("bot", reply);
  } catch (err) {
    appendMessage(
      "bot",
      "Sorry, I couldn't generate a routine right now. Please try again."
    );
    console.error(err);
  }
});

/* Chat follow-up handler */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  if (!state.routineGenerated) {
    appendMessage(
      "bot",
      "Please generate a routine first, then ask follow-up questions."
    );
    userInput.value = "";
    return;
  }

  appendMessage("user", text);
  state.messages.push({ role: "user", content: text });

  try {
    const reply = await askOpenAI(state.messages);
    state.messages.push({ role: "assistant", content: reply });
    appendMessage("bot", reply);
  } catch (err) {
    appendMessage(
      "bot",
      "Sorry, I couldn't answer that just now. Please try again."
    );
    console.error(err);
  } finally {
    userInput.value = "";
  }
});

/* Initialize: load all products, then render selected list */
(async function init() {
  state.allProducts = await loadProducts();
  renderSelectedProducts();
})();

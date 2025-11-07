# Project 9: L'Oréal Routine Builder

L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder.

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## API setup (beginner-friendly)

Preferred: use a Cloudflare Worker to keep your API key safe.

1. Create a Worker that proxies to OpenAI’s chat completions API and returns the same JSON shape (`choices[0].message.content`).
2. In `secrets.js`, set:

```html
<!-- filepath: /workspaces/09-prj-loreal-routine-builder/secrets.js -->
<script>
  // Using your deployed Cloudflare Worker
  window.CFWORKER_URL = "https://gentle-cherry.james-hosey3.workers.dev/";
</script>
```

3. The app will use `window.CFWORKER_URL` if present. If not, it will fallback to calling OpenAI directly with `window.OPENAI_API_KEY`.

Notes:

- We use async/await with fetch and the `messages` parameter.
- We check `data.choices[0].message.content` from the response.
- The chatbot remembers history and answers only beauty-related questions.

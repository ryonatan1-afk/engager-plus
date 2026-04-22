# Test greeting generation

Generate a sample AI greeting for a given contact + holiday combination. 

Prompt Claude Code to run the greeting generator with test data. For example:

"Generate a greeting for Yuki Tanaka at Mitsubishi Electric in Japan for Shunbun no Hi on March 25"

Claude will:
1. Construct the prompt using the template in `docs/architecture.md`
2. Call the Anthropic API
3. Print the result to console

Use this to tune the prompt template before running the full Sunday pre-generation job.

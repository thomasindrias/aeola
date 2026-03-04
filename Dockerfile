FROM mcr.microsoft.com/playwright:v1.48.0-noble

# Install Deno
RUN curl -fsSL https://deno.land/install.sh | sh -s -- v2.1.4
ENV DENO_INSTALL="/root/.deno"
ENV PATH="${DENO_INSTALL}/bin:${PATH}"

# Install agent-browser globally
RUN npm install -g agent-browser

WORKDIR /app

COPY deno.json .
COPY . .

# Cache dependencies
RUN deno cache src/main.ts

# Install only Chromium (for Crawlee)
RUN deno run -A npm:playwright install --with-deps chromium

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", "--allow-ffi", "--allow-run", "src/main.ts"]

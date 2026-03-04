FROM mcr.microsoft.com/playwright:v1.48.0-noble

# Install unzip (required by Deno installer) and Deno
RUN apt-get update && apt-get install -y unzip && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://deno.land/install.sh | sh -s -- v2.7.3
ENV DENO_INSTALL="/root/.deno"
ENV PATH="${DENO_INSTALL}/bin:${PATH}"

# Install agent-browser globally
RUN npm install -g agent-browser

WORKDIR /app

# Copy dependency manifest first for layer caching
COPY deno.json deno.lock ./

# Copy source
COPY src/ src/
COPY CLAUDE.md .

# Cache dependencies
RUN deno cache src/main.ts

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", "--allow-ffi", "--allow-run", "src/main.ts"]

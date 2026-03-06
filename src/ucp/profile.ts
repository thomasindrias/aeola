export interface UcpCapability {
  name: string;
  version: string;
  spec: string;
  schema: string;
  extends?: string;
  config?: Record<string, unknown>;
}

export interface UcpServiceTransport {
  schema?: string;
  endpoint: string;
}

export interface UcpService {
  version: string;
  spec?: string;
  rest?: UcpServiceTransport;
  mcp?: UcpServiceTransport;
}

export interface UcpProfile {
  ucp: {
    version: string;
    services: Record<string, UcpService>;
    capabilities: UcpCapability[];
  };
}

const UCP_VERSION = "2026-01-11";

export function getUcpProfile(): UcpProfile {
  return {
    ucp: {
      version: UCP_VERSION,
      services: {
        "io.aeola.catalog": {
          version: UCP_VERSION,
          rest: {
            endpoint: "/api/ucp/merchants/{id}/products",
          },
          mcp: {
            endpoint: "/mcp",
          },
        },
      },
      capabilities: [
        {
          name: "io.aeola.product_catalog",
          version: UCP_VERSION,
          spec: "https://github.com/thomasindrias/aeola#ucp",
          schema: "/openapi.json#/components/schemas/GoogleMerchantProduct",
        },
      ],
    },
  };
}

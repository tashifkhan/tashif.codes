"""
Shared HTTP Client
Provides a global, pooled httpx.AsyncClient for backend service requests.
This avoids establishing new TLS handshakes for every single PostHog/Cloudflare query.
"""

import httpx

# A single global client instance with connection pooling enabled.
# The timeouts and limits can be tuned as needed.
http_client = httpx.AsyncClient(
    limits=httpx.Limits(max_keepalive_connections=50, max_connections=100),
    timeout=httpx.Timeout(20.0),
)

async def get_client() -> httpx.AsyncClient:
    """Returns the shared asynchronous HTTP client."""
    return http_client

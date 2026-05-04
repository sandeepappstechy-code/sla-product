<?php

return [
    'agno_service_url' => env('SLA_AGNO_SERVICE_URL', 'http://localhost:8001'),
    'agno_timeout_seconds' => (int) env('SLA_AGNO_TIMEOUT_SECONDS', 90),
];

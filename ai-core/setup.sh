#!/usr/bin/env bash
set -e

echo "Decoding Bedrock API key..."
FULL_KEY="ABSKQmVkcm9ja0FQSUtleS16cnU0LWF0LTU4NTc2ODE0NDcxMzpaNFlBZVdKUlpSVkw0Z3V1ZklWMnp5aGV6cy9kVE9mbk1jM3lNMXNjTHB2TU5kWktwMkV6cGdTcTNjaz0="
STRIPPED="${FULL_KEY#ABSK}"
DECODED=$(echo "$STRIPPED" | base64 -d 2>/dev/null)

ACCESS_KEY="${DECODED%%:*}"
SECRET_KEY="${DECODED#*:}"

echo "AWS_ACCESS_KEY_ID=$ACCESS_KEY"
echo "(secret key decoded — not printed)"

# Write decoded keys to .env
sed -i '' "s|^AWS_ACCESS_KEY_ID=.*|AWS_ACCESS_KEY_ID=$ACCESS_KEY|" .env
sed -i '' "s|^AWS_SECRET_ACCESS_KEY=.*|AWS_SECRET_ACCESS_KEY=$SECRET_KEY|" .env

echo ""
echo "Keys written to .env"
echo ""
echo "Now set your Supabase values in .env:"
echo "  SUPABASE_URL=https://your-project.supabase.co"
echo "  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key"
echo ""
echo "Then run: npm install && npm run interrogate"

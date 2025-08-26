#!/bin/bash
set -e

# ===========================
# CONFIG
# ===========================
CERTS_DIR="./certs"
SERVER_DIR="$CERTS_DIR/server"
CLIENT_DIR="$CERTS_DIR/client"
DAYS=365
SERVER_IP="192.168.1.93"

rm -rf "$CERTS_DIR"
mkdir -p "$SERVER_DIR" "$CLIENT_DIR"

# Create OpenSSL config files
cat > "$CERTS_DIR/ca.conf" << EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_ca
prompt = no

[req_distinguished_name]
C = US
ST = CA
O = MyOrg, Inc.
CN = MyRootCA

[v3_ca]
basicConstraints = critical, CA:true
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
EOF

cat > "$SERVER_DIR/server.conf" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = CA
O = MyOrg, Inc.
CN = $SERVER_IP

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = $SERVER_IP
EOF

cat > "$CLIENT_DIR/client.conf" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = CA
O = MyOrg, Inc.
CN = client

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth
EOF

echo "=== Generating Root CA ==="
openssl genrsa -out "$CERTS_DIR/ca.key" 4096
openssl req -x509 -new -nodes \
-key "$CERTS_DIR/ca.key" \
-sha256 -days 3650 \
-out "$CERTS_DIR/ca.pem" \
-config "$CERTS_DIR/ca.conf"

echo "=== Generating Server Key/CSR/Cert ==="
openssl genrsa -out "$SERVER_DIR/key.pem" 2048
openssl req -new \
-key "$SERVER_DIR/key.pem" \
-out "$SERVER_DIR/server.csr" \
-config "$SERVER_DIR/server.conf"

openssl x509 -req -in "$SERVER_DIR/server.csr" \
-CA "$CERTS_DIR/ca.pem" \
-CAkey "$CERTS_DIR/ca.key" \
-CAcreateserial \
-out "$SERVER_DIR/cert.pem" \
-days $DAYS -sha256 \
-extensions v3_req \
-extfile "$SERVER_DIR/server.conf"

# Copy CA to server folder for easier trust reference
# cp "$CERTS_DIR/ca.pem" "$SERVER_DIR/ca.pem"

echo "=== Generating Client Key/CSR/Cert ==="
openssl genrsa -out "$CLIENT_DIR/key.pem" 2048
openssl req -new \
-key "$CLIENT_DIR/key.pem" \
-out "$CLIENT_DIR/client.csr" \
-config "$CLIENT_DIR/client.conf"

openssl x509 -req -in "$CLIENT_DIR/client.csr" \
-CA "$CERTS_DIR/ca.pem" \
-CAkey "$CERTS_DIR/ca.key" \
-CAcreateserial \
-out "$CLIENT_DIR/cert.pem" \
-days $DAYS -sha256 \
-extensions v3_req \
-extfile "$CLIENT_DIR/client.conf"

# Copy CA to client folder for easier trust reference
# cp "$CERTS_DIR/ca.pem" "$CLIENT_DIR/ca.pem"

echo "=== Verification ==="
echo "Verifying server certificate..."
openssl verify -CAfile "$CERTS_DIR/ca.pem" "$SERVER_DIR/cert.pem"

echo "Verifying client certificate..."
openssl verify -CAfile "$CERTS_DIR/ca.pem" "$CLIENT_DIR/cert.pem"

echo "=== Certificate Details ==="
echo "Server certificate SAN:"
openssl x509 -in "$SERVER_DIR/cert.pem" -text -noout | grep -A 3 "Subject Alternative Name"

echo "=== Done ==="
echo "Server certs: $SERVER_DIR"
echo "Client certs: $CLIENT_DIR"

# Cleanup config files
# rm -f "$CERTS_DIR/ca.conf" "$SERVER_DIR/server.conf" "$CLIENT_DIR/client.conf" # "$CERTS_DIR/ca.srl" "$CERTS_DIR/ca.pem" "$CERTS_DIR/ca.key"
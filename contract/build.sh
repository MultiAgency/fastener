#!/bin/bash
set -e

RUSTFLAGS='-C link-arg=-s' cargo build --target wasm32-unknown-unknown --release

mkdir -p res
cp target/wasm32-unknown-unknown/release/fastener_contract.wasm res/
echo "Contract built: res/fastener_contract.wasm"

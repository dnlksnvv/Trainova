#!/bin/bash

PROJECT_DIR="$(pwd)"

python3.11 -m venv "venv"

source "venv/bin/activate"

pip install -r "$PROJECT_DIR/requirements.txt"

python "$PROJECT_DIR/main.py" 
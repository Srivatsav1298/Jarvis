# Fix: upstream hwdsl2/kokoro-server arm64 `latest` bundles a CUDA-flavored
# torch wheel (torch.version.cuda set) without the CUDA shared libs, so torch
# import crashes on CPU-only arm64 hosts ("libcublasLt.so.*[0-9] not found").
# Reinstall the CPU wheel from the PyTorch CPU index on top of the base image.
FROM hwdsl2/kokoro-server:latest

RUN pip install --no-cache-dir --force-reinstall \
    --index-url https://download.pytorch.org/whl/cpu \
    torch

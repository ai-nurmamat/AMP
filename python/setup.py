import os
from setuptools import setup, find_packages

# Resolve README.md path (can be in current dir or parent dir)
readme_path = os.path.join(os.path.dirname(__file__), "..", "README.md")
if not os.path.exists(readme_path):
    readme_path = os.path.join(os.path.dirname(__file__), "README.md")

long_description = open(readme_path, encoding="utf-8").read() if os.path.exists(readme_path) else "AMP (Agent Memory Protocol) - AI Agent Memory Engine"

setup(
    name="agent-memory-protocol",
    version="0.4.0",
    author="OpenClaw Team",
    author_email="founders@openclaw.ai",
    description="跨智能体记忆协议",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/openclaw/amp",
    packages=find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    python_requires=">=3.8",
    install_requires=[
        "pydantic>=2.0.0",
    ],
)
from setuptools import setup, find_packages

setup(
    name="amp-memory",
    version="1.0.0",
    author="OpenClaw Team",
    author_email="founders@openclaw.ai",
    description="AMP (Agent Memory Protocol) - 业界首创的完全自主研发的AI Agent记忆引擎，跨生态、图向量双轨检索引擎。",
    long_description=open("README.md", encoding="utf-8").read(),
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
# FinCascade

### Financial Market Shock Propagation & Systemic Risk Intelligence Platform

FinCascade is an AI-powered financial systemic-risk platform that models how shocks propagate across interconnected financial assets, sectors, commodities, currencies, and market indices.

Instead of treating financial assets independently, FinCascade represents the market as a dynamic dependency network and combines:

- Financial graph analytics
- Lagged dependency modelling
- Machine-learning-based systemic stress detection
- Multi-hop shock propagation
- Systemic risk scoring
- Cross-scenario vulnerability analysis
- Explainable contagion pathways

The system allows users to simulate events such as a banking crisis, market crash, commodity shock, technology sell-off, currency shock, or custom financial event and observe how risk spreads through the market.

---

# Problem Statement

Financial markets are highly interconnected.

A shock originating in one asset or sector can affect many others through:

- sector dependencies
- index exposure
- commodity sensitivity
- banking relationships
- currency movements
- investor behaviour
- macroeconomic transmission

Traditional dashboards typically show asset-level price movements but do not explain:

> How could a shock spread across the financial system?

FinCascade addresses this by building an interconnected financial network and simulating contagion across that network.

---

# Core Capabilities

## 1. Financial Dependency Network

FinCascade models 26 financial entities including:

- NIFTY 50
- Bank Nifty
- Major Indian banks
- IT companies
- Automobile companies
- Energy companies
- NBFCs
- Realty companies
- Pharma companies
- FMCG companies
- Crude Oil
- Gold
- USD/INR

The final directed graph contains:

- **26 financial nodes**
- **155 directed dependency edges**

Relationships are derived using:

- Pearson correlation
- Lagged correlation
- Directional dependency analysis
- Network centrality

---

# 2. Machine Learning Systemic Stress Engine

FinCascade uses a three-model unsupervised ML ensemble instead of relying on unstable short-term stock-price prediction.

The ML engine consists of:

### Isolation Forest

Detects unusual multivariate market states by isolating anomalous observations.

### PCA Reconstruction Error

Learns the normal structural relationships between market features.

Large reconstruction errors indicate that the financial system is behaving differently from its historical structure.

### One-Class SVM

Learns the boundary of normal market behaviour and detects observations outside that normal region.

---

# ML Feature Engineering

The stress engine uses **18 systemic financial features**, including:

- NIFTY daily return
- Bank Nifty daily return
- Crude Oil return
- Gold return
- USD/INR return
- Mean market return
- Market dispersion
- Worst-performing asset return
- Best-performing asset return
- Negative market breadth
- Severe-loss breadth
- Absolute NIFTY movement
- 5-day NIFTY volatility
- 20-day NIFTY volatility
- 20-day banking volatility
- 20-day system volatility
- 5-day NIFTY cumulative return
- 5-day banking cumulative return

Historical ML dataset:

- **1,377 observations**
- **18 engineered features**

---

# Ensemble ML Stress Score

Each ML detector produces an anomaly score.

The scores are converted into historical percentile values between 0 and 100.

The ensemble score is:

```text
ML Stress Score
=
40% Isolation Forest
+
30% PCA Reconstruction
+
30% One-Class SVM
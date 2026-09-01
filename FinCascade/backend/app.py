from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, Field
from typing import Dict, Optional
import math

from engine import (
    GRAPH_DATA,
    SCENARIOS,
    DG,
    metadata,
    vulnerability_df,
    ml_stress,
    run_scenario,
    compare_scenarios,
    get_latest_ml_context
)


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="FinCascade API",
    description=(
        "Financial Market Shock Propagation, "
        "Systemic Stress Detection and Risk Analytics Engine"
    ),
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    # Fine for hackathon/demo frontend
    allow_origins=["*"],

    # No login/authentication required
    allow_credentials=False,

    allow_methods=["*"],
    allow_headers=["*"]
)


# ============================================================
# REQUEST MODEL
# ============================================================

class ShockRequest(BaseModel):

    shocks: Dict[str, float]

    scenario_name: Optional[str] = (
        "Custom Scenario"
    )

    max_abs_shock: float = Field(
        default=0.50,
        ge=0.01,
        le=0.50,
        description=(
            "Maximum allowed absolute shock "
            "expressed as a decimal."
        )
    )

    # Better example inside Swagger UI
    model_config = {
        "json_schema_extra": {
            "example": {
                "shocks": {
                    "^NSEI": -0.10
                },
                "scenario_name":
                    "Custom NIFTY Shock",
                "max_abs_shock": 0.50
            }
        }
    }


# ============================================================
# ROOT
# ============================================================

@app.get(
    "/",
    tags=["System"]
)
def root():

    return {
        "project": "FinCascade",
        "status": "online",
        "description":
            "Financial Market Systemic Risk Engine",
        "nodes": DG.number_of_nodes(),
        "edges": DG.number_of_edges(),
        "ml_engine":
            "Isolation Forest + PCA + One-Class SVM"
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get(
    "/health",
    tags=["System"]
)
def health():

    return {
        "status": "healthy",
        "service":
            "FinCascade Systemic Risk Engine",
        "graph_loaded": True,
        "ml_data_loaded": (
            len(ml_stress) > 0
        )
    }


# ============================================================
# FINANCIAL ENTITIES
# ============================================================

@app.get(
    "/entities",
    tags=["Market"]
)
def entities():

    entity_data = (
        metadata[
            [
                "ticker",
                "name",
                "type",
                "sector"
            ]
        ]
        .to_dict(
            orient="records"
        )
    )

    return {
        "count": len(entity_data),
        "entities": entity_data
    }


# ============================================================
# NETWORK GRAPH
# ============================================================

@app.get(
    "/network",
    tags=["Network"]
)
def network():

    return {
        "node_count":
            DG.number_of_nodes(),

        "edge_count":
            DG.number_of_edges(),

        "nodes":
            GRAPH_DATA["nodes"],

        "edges":
            GRAPH_DATA["edges"]
    }


# ============================================================
# PRESET SCENARIOS
# ============================================================

@app.get(
    "/scenarios",
    tags=["Simulation"]
)
def scenarios():

    return {
        "count": len(SCENARIOS),
        "scenarios": SCENARIOS
    }


# ============================================================
# RUN PRESET SCENARIO
# ============================================================

@app.get(
    "/simulate/preset/{scenario_name}",
    tags=["Simulation"]
)
def simulate_preset(
    scenario_name: str
):

    if scenario_name not in SCENARIOS:

        raise HTTPException(
            status_code=404,
            detail={
                "message":
                    "Unknown scenario",

                "available_scenarios":
                    list(
                        SCENARIOS.keys()
                    )
            }
        )

    try:

        return run_scenario(
            SCENARIOS[
                scenario_name
            ],
            scenario_name
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ============================================================
# CUSTOM SHOCK SIMULATION
# ============================================================

@app.post(
    "/simulate",
    tags=["Simulation"]
)
def simulate_custom(
    request: ShockRequest
):

    # Must contain at least one shock
    if not request.shocks:

        raise HTTPException(
            status_code=400,
            detail=(
                "At least one financial "
                "shock is required."
            )
        )


    # Check entity IDs
    invalid_entities = [
        ticker
        for ticker
        in request.shocks
        if ticker not in DG.nodes
    ]

    if invalid_entities:

        raise HTTPException(
            status_code=400,
            detail={
                "message":
                    "Unknown financial entities",

                "invalid":
                    invalid_entities
            }
        )


    # Reject NaN / Infinity
    invalid_values = [
        ticker
        for ticker, shock
        in request.shocks.items()
        if not math.isfinite(shock)
    ]

    if invalid_values:

        raise HTTPException(
            status_code=400,
            detail={
                "message":
                    "Shock values must be finite numbers",

                "invalid":
                    invalid_values
            }
        )


    # Restrict shock magnitude
    clipped_shocks = {}

    for ticker, shock in (
        request.shocks.items()
    ):

        clipped_shocks[ticker] = max(
            -request.max_abs_shock,
            min(
                request.max_abs_shock,
                float(shock)
            )
        )


    try:

        return run_scenario(
            clipped_shocks,
            request.scenario_name
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ============================================================
# COMPARE PRESET SCENARIOS
# ============================================================

@app.get(
    "/compare",
    tags=["Analytics"]
)
def compare():

    return {
        "ranking":
            compare_scenarios()
    }


# ============================================================
# CROSS-SCENARIO VULNERABILITY
# ============================================================

@app.get(
    "/vulnerability",
    tags=["Analytics"]
)
def vulnerability(
    limit: int = 15
):

    limit = max(
        1,
        min(
            limit,
            len(
                vulnerability_df
            )
        )
    )

    ranking = (
        vulnerability_df
        .head(limit)
        .where(
            vulnerability_df
            .head(limit)
            .notna(),
            None
        )
        .to_dict(
            orient="records"
        )
    )

    return {
        "title":
            "Cross-Scenario Vulnerability Ranking",

        "count":
            len(ranking),

        "ranking":
            ranking
    }


# ============================================================
# CURRENT ML SYSTEMIC STRESS
# ============================================================

@app.get(
    "/stress/current",
    tags=["Machine Learning"]
)
def current_stress():

    if len(ml_stress) == 0:

        raise HTTPException(
            status_code=503,
            detail=(
                "ML stress data "
                "is unavailable."
            )
        )


    latest = (
        ml_stress.iloc[-1]
    )


    return {
        "ml_stress_score":
            round(
                float(
                    latest[
                        "ml_stress_score"
                    ]
                ),
                2
            ),

        "downside_stress":
            round(
                float(
                    latest[
                        "downside_stress"
                    ]
                ),
                2
            ),

        "ml_market_risk_score":
            round(
                get_latest_ml_context(),
                2
            ),

        "stress_regime":
            str(
                latest[
                    "stress_regime"
                ]
            ),

        "model_agreement":
            int(
                latest.get(
                    "model_agreement",
                    0
                )
            ),

        "methodology": {
            "models": [
                "Isolation Forest",
                "PCA Reconstruction",
                "One-Class SVM"
            ],
            "feature_count": 18,
            "score_type":
                "Historical relative systemic stress"
        }
    }
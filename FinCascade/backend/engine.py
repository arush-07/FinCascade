from pathlib import Path
import json

import numpy as np
import pandas as pd
import networkx as nx


# ==========================================
# PATHS
# ==========================================

ROOT = Path(__file__).resolve().parents[1]

DATA_DIR = ROOT / "data"
GRAPH_DIR = ROOT / "graph"


# ==========================================
# LOAD DATA
# ==========================================

with open(
    GRAPH_DIR / "graph.json",
    "r",
    encoding="utf-8"
) as f:
    GRAPH_DATA = json.load(f)


with open(
    DATA_DIR / "scenario_presets.json",
    "r",
    encoding="utf-8"
) as f:
    SCENARIOS = json.load(f)


metadata = pd.read_csv(
    DATA_DIR / "entities.csv"
)

ml_stress = pd.read_csv(
    DATA_DIR / "ml_stress_scores.csv"
)

vulnerability_df = pd.read_csv(
    DATA_DIR / "vulnerability_ranking.csv"
)


NAME_MAP = metadata.set_index(
    "ticker"
)["name"].to_dict()

SECTOR_MAP = metadata.set_index(
    "ticker"
)["sector"].to_dict()


# ==========================================
# BUILD GRAPH
# ==========================================

DG = nx.DiGraph()

for node in GRAPH_DATA["nodes"]:

    node_id = node["id"]

    attrs = {
        k: v
        for k, v in node.items()
        if k != "id"
    }

    DG.add_node(
        node_id,
        **attrs
    )


for edge in GRAPH_DATA["edges"]:

    source = edge["source"]
    target = edge["target"]

    attrs = {
        k: v
        for k, v in edge.items()
        if k not in ["source", "target"]
    }

    DG.add_edge(
        source,
        target,
        **attrs
    )


# ==========================================
# EDGE EFFECT
# ==========================================

def get_edge_effect(attrs):

    lag_corr = attrs.get(
        "lag_correlation"
    )

    corr = attrs.get(
        "correlation"
    )

    if (
        lag_corr is not None
        and pd.notna(lag_corr)
        and lag_corr != 0
    ):
        effect = float(lag_corr)

    elif (
        corr is not None
        and pd.notna(corr)
    ):
        effect = float(corr)

    else:
        effect = float(
            attrs.get("weight", 0)
        )

    return float(
        np.clip(
            effect,
            -0.95,
            0.95
        )
    )


# ==========================================
# NORMALIZED TRANSMISSION
# ==========================================

TRANSMISSION = {}

for source in DG.nodes():

    raw_edges = {}

    for target in DG.successors(source):

        raw_edges[target] = (
            get_edge_effect(
                DG[source][target]
            )
        )

    total_strength = sum(
        abs(v)
        for v in raw_edges.values()
    )

    scale = max(
        1.0,
        total_strength
    )

    TRANSMISSION[source] = {
        target: effect / scale
        for target, effect
        in raw_edges.items()
    }


# ==========================================
# SHOCK SIMULATION
# ==========================================

def simulate_shock(
    initial_shocks,
    max_hops=4,
    damping=0.55,
    min_propagation=0.0005,
    shock_cap=0.50
):

    total_impact = {
        node: 0.0
        for node in DG.nodes()
    }

    frontier = {}

    paths = []

    for node, shock in initial_shocks.items():

        if node not in DG:
            raise ValueError(
                f"Unknown financial entity: {node}"
            )

        shock = float(
            np.clip(
                shock,
                -shock_cap,
                shock_cap
            )
        )

        total_impact[node] = shock
        frontier[node] = shock


    for hop in range(
        1,
        max_hops + 1
    ):

        next_frontier = {}

        for source, source_delta in frontier.items():

            for target, effect in (
                TRANSMISSION
                .get(source, {})
                .items()
            ):

                propagated = (
                    source_delta
                    * effect
                    * damping
                )

                if abs(propagated) < min_propagation:
                    continue

                next_frontier[target] = (
                    next_frontier.get(
                        target,
                        0.0
                    )
                    + propagated
                )

                paths.append({
                    "hop": hop,
                    "source": source,
                    "source_name":
                        NAME_MAP.get(
                            source,
                            source
                        ),
                    "target": target,
                    "target_name":
                        NAME_MAP.get(
                            target,
                            target
                        ),
                    "transmission_effect":
                        float(effect),
                    "propagated_pct":
                        float(
                            propagated * 100
                        )
                })


        for target in next_frontier:

            next_frontier[target] = float(
                np.clip(
                    next_frontier[target],
                    -shock_cap,
                    shock_cap
                )
            )

            total_impact[target] = float(
                np.clip(
                    total_impact[target]
                    + next_frontier[target],
                    -shock_cap,
                    shock_cap
                )
            )

        frontier = next_frontier

        if not frontier:
            break


    results = []

    for ticker, shock in total_impact.items():

        results.append({
            "ticker": ticker,
            "name":
                NAME_MAP.get(
                    ticker,
                    ticker
                ),
            "sector":
                SECTOR_MAP.get(
                    ticker,
                    "Unknown"
                ),
            "shock_pct":
                float(shock * 100),
            "absolute_impact_pct":
                float(abs(shock * 100))
        })


    results = sorted(
        results,
        key=lambda x:
            x["absolute_impact_pct"],
        reverse=True
    )

    paths = sorted(
        paths,
        key=lambda x:
            abs(x["propagated_pct"]),
        reverse=True
    )

    return results, paths


# ==========================================
# SYSTEMIC RISK
# ==========================================

def get_latest_ml_context():

    if "ml_market_risk_score" not in ml_stress.columns:
        return 0.0

    return float(
        ml_stress[
            "ml_market_risk_score"
        ].iloc[-1]
    )


def calculate_systemic_risk(
    results,
    initial_shocks
):

    initial_nodes = set(
        initial_shocks.keys()
    )

    secondary = [
        row
        for row in results
        if row["ticker"]
        not in initial_nodes
    ]


    impacts = [
        row["absolute_impact_pct"]
        for row in secondary
    ]

    mean_secondary_impact = (
        float(np.mean(impacts))
        if impacts
        else 0.0
    )


    propagation_score = min(
        (
            mean_secondary_impact
            / 5
        ) * 100,
        100
    )


    affected = sum(
        impact >= 0.5
        for impact in impacts
    )


    breadth_score = (
        affected
        / max(
            len(secondary),
            1
        )
    ) * 100


    max_pagerank = max(
        float(
            DG.nodes[n].get(
                "pagerank",
                0
            )
        )
        for n in DG.nodes()
    )


    source_scores = []

    for source in initial_nodes:

        pagerank = float(
            DG.nodes[source].get(
                "pagerank",
                0
            )
        )

        score = (
            pagerank
            / max(
                max_pagerank,
                1e-9
            )
        ) * 100

        source_scores.append(score)


    centrality_score = (
        float(
            np.mean(source_scores)
        )
        if source_scores
        else 0.0
    )


    ml_context_score = (
        get_latest_ml_context()
    )


    systemic_score = (
        0.35 * propagation_score
        +
        0.25 * breadth_score
        +
        0.20 * centrality_score
        +
        0.20 * ml_context_score
    )


    systemic_score = float(
        np.clip(
            systemic_score,
            0,
            100
        )
    )


    if systemic_score >= 65:
        level = "CRITICAL"

    elif systemic_score >= 45:
        level = "HIGH"

    elif systemic_score >= 25:
        level = "MODERATE"

    else:
        level = "LOW"


    return {
        "systemic_risk_score":
            round(systemic_score, 2),

        "risk_level":
            level,

        "propagation_score":
            round(
                propagation_score,
                2
            ),

        "breadth_score":
            round(
                breadth_score,
                2
            ),

        "centrality_score":
            round(
                centrality_score,
                2
            ),

        "ml_context_score":
            round(
                ml_context_score,
                2
            ),

        "affected_entities":
            int(affected),

        "mean_secondary_impact_pct":
            round(
                mean_secondary_impact,
                4
            )
    }


# ==========================================
# COMPLETE SCENARIO
# ==========================================

def run_scenario(
    shocks,
    scenario_name="Custom Scenario"
):

    results, paths = simulate_shock(
        shocks
    )

    risk = calculate_systemic_risk(
        results,
        shocks
    )

    return {
        "scenario":
            scenario_name,

        "initial_shocks":
            shocks,

        "risk":
            risk,

        "impacts":
            results,

        "top_pathways":
            paths[:20]
    }


# ==========================================
# SCENARIO COMPARISON
# ==========================================

def compare_scenarios():

    comparison = []

    for name, shocks in SCENARIOS.items():

        output = run_scenario(
            shocks,
            name
        )

        comparison.append({
            "scenario":
                name,

            **output["risk"]
        })


    return sorted(
        comparison,
        key=lambda x:
            x[
                "systemic_risk_score"
            ],
        reverse=True
    )
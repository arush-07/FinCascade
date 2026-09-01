import { useEffect, useMemo, useState } from "react";

import {
  Activity,
  ArrowUpRight,
  BrainCircuit,
  ChevronRight,
  CircleDot,
  Network,
  ShieldAlert,
  Sparkles
} from "lucide-react";

import logo from "./assets/logo.png";

import NetworkGraph from "./components/NetworkGraph";

import {
  getCurrentStress,
  getEntities,
  getNetwork,
  getScenarios,
  runPresetScenario
} from "./services/api";

import "./App.css";

const scenarioLabels = {
  "Market Crash": "MARKET",
  "Banking Crisis": "BANKING",
  "Tech Crash": "TECH",
  "Oil Crash": "ENERGY",
  "Currency Shock": "FX",
  "Rate Hike Proxy": "RATES"
};

function App() {
  const [network, setNetwork] = useState(null);
  const [entities, setEntities] = useState([]);
  const [scenarios, setScenarios] = useState({});
  const [stress, setStress] = useState(null);
  const [simulation, setSimulation] = useState(null);

  const [selectedScenario, setSelectedScenario] =
    useState("Market Crash");

  const [selectedNode, setSelectedNode] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [
          networkRes,
          entityRes,
          scenarioRes,
          stressRes,
          simulationRes
        ] = await Promise.all([
          getNetwork(),
          getEntities(),
          getScenarios(),
          getCurrentStress(),
          runPresetScenario("Market Crash")
        ]);

        setNetwork(networkRes.data);
        setEntities(entityRes.data.entities);
        setScenarios(scenarioRes.data.scenarios);
        setStress(stressRes.data);
        setSimulation(simulationRes.data);
      } catch (err) {
        console.error(err);

        setError(
          "Unable to connect to the FinCascade risk engine."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  async function handleScenario(name) {
    try {
      setSelectedScenario(name);
      setSelectedNode(null);
      setSimulating(true);

      const response =
        await runPresetScenario(name);

      setSimulation(response.data);
    } catch (err) {
      console.error(err);
      setError("Simulation failed.");
    } finally {
      setSimulating(false);
    }
  }

  const risk = simulation?.risk || {};
  const impacts = simulation?.impacts || [];

  const meaningfulImpacts = useMemo(
    () =>
      impacts.filter(
        (item) =>
          Math.abs(item.shock_pct) >= 0.5
      ),
    [impacts]
  );

  const initialNodes = Object.keys(
    simulation?.initial_shocks || {}
  );

  const strongestSecondary =
    meaningfulImpacts.find(
      (item) =>
        !initialNodes.includes(item.ticker)
    );

  if (loading) {
    return (
      <div className="app-loading">
        <img src={logo} alt="FinCascade Logo" className="loader-logo-image" />

        <p>
          Mapping the financial system...
        </p>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <div className="grain" />

      <nav className="top-nav">
        <div className="brand">
          <img src={logo} alt="FinCascade Logo" className="brand-image" />
          <div>
            <strong>FinCascade</strong>
            <span>Systemic Risk Intelligence</span>
          </div>
        </div>

        <div className="nav-status">
          <i />

          RISK ENGINE ONLINE

          <b>/</b>

          {entities.length || 26} ENTITIES

          <b>/</b>

          {network?.edge_count || 155} LINKS
        </div>
      </nav>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <section className="hero">
        <div className="hero-kicker">
          FINANCIAL SYSTEMIC RISK
          <ArrowUpRight size={13} />
        </div>

        <h1>
          See the shock.
          <br />

          <em>
            Trace the contagion.
          </em>
        </h1>

        <div className="hero-footer">
          <p>
            Stress-test interconnected financial
            markets through machine learning,
            network intelligence and multi-hop
            contagion simulation.
          </p>

          <div className="market-context">
            <span>
              CURRENT ML MARKET RISK
            </span>

            <strong>
              {Number(
                stress?.ml_market_risk_score || 0
              ).toFixed(1)}
            </strong>

            <small>
              {stress?.stress_regime || "UNKNOWN"}
            </small>
          </div>
        </div>

        <div className="hero-lines">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </section>

      <section className="scenario-section">
        <div className="section-index">
          01
        </div>

        <div className="scenario-content">
          <div className="section-heading">
            <div>
              <span>STRESS LAB</span>

              <h2>
                Inject a market shock.
              </h2>
            </div>

            <p>
              Select a predefined systemic event.
              FinCascade propagates it through the
              financial dependency network.
            </p>
          </div>

          <div className="scenario-grid">
            {Object.keys(scenarios).map(
              (name) => (
                <button
                  key={name}
                  className={
                    selectedScenario === name
                      ? "scenario-card active"
                      : "scenario-card"
                  }
                  onClick={() =>
                    handleScenario(name)
                  }
                >
                  <span>
                    {scenarioLabels[name] ||
                      "SCENARIO"}
                  </span>

                  <strong>{name}</strong>

                  <ChevronRight size={15} />
                </button>
              )
            )}

            <button className="scenario-card custom">
              <span>YOUR SHOCK</span>

              <strong>
                Custom Scenario
              </strong>

              <Sparkles size={15} />
            </button>
          </div>
        </div>
      </section>

      <section className="network-section">
        <div className="network-heading">
          <div>
            <span>
              02 / CONTAGION MAP
            </span>

            <h2>
              Financial dependency network
            </h2>
          </div>

          <div className="legend">
            <span>
              <i className="negative" />
              Negative impact
            </span>

            <span>
              <i className="positive" />
              Positive response
            </span>

            <span>
              <i className="neutral" />
              Connected
            </span>
          </div>
        </div>

        <div className="network-frame">
          <div className="scenario-tag">
            <span>
              ACTIVE SCENARIO
            </span>

            <strong>
              {selectedScenario}
            </strong>
          </div>

          <div className="affected-tag">
            {simulating
              ? "PROPAGATING..."
              : `${meaningfulImpacts.length} AFFECTED NODES`}
          </div>

          <NetworkGraph
            network={network}
            impacts={impacts}
            selectedNode={selectedNode}
            onNodeSelect={setSelectedNode}
          />

          {selectedNode && (
            <div className="node-panel">
              <button
                onClick={() =>
                  setSelectedNode(null)
                }
              >
                ×
              </button>

              <span>
                SELECTED ENTITY
              </span>

              <h3>
                {selectedNode.name ||
                  selectedNode.id}
              </h3>

              <p>
                {selectedNode.sector}
              </p>

              <div>
                <span>
                  PageRank
                </span>

                <strong>
                  {Number(
                    selectedNode.pagerank || 0
                  ).toFixed(4)}
                </strong>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="risk-grid">
        <div className="risk-main">
          <span>
            SYSTEMIC RISK
          </span>

          <div>
            <strong>
              {Number(
                risk.systemic_risk_score || 0
              ).toFixed(1)}
            </strong>

            <small>/ 100</small>
          </div>

          <p
            className={`risk-level ${
              risk.risk_level?.toLowerCase() || ""
            }`}
          >
            {risk.risk_level || "UNKNOWN"}
          </p>
        </div>

        <Metric
          icon={<Activity />}
          label="PROPAGATION"
          value={Number(
            risk.propagation_score || 0
          ).toFixed(1)}
          description="Network intensity"
        />

        <Metric
          icon={<Network />}
          label="BREADTH"
          value={`${Number(
            risk.breadth_score || 0
          ).toFixed(0)}%`}
          description="System reach"
        />

        <Metric
          icon={<ShieldAlert />}
          label="AFFECTED"
          value={risk.affected_entities ?? 0}
          description="Secondary entities"
        />

        <Metric
          icon={<BrainCircuit />}
          label="ML CONTEXT"
          value={Number(
            risk.ml_context_score || 0
          ).toFixed(1)}
          description="Current market state"
        />
      </section>

      <section className="insight">
        <CircleDot size={18} />

        <p>
          Under the{" "}
          <strong>
            {selectedScenario}
          </strong>{" "}
          scenario, FinCascade estimates{" "}
          <strong>
            {risk.affected_entities ?? 0}
          </strong>{" "}
          secondary entities receive meaningful
          propagated impact
          {strongestSecondary && (
            <>
              , with{" "}
              <strong>
                {strongestSecondary.name}
              </strong>{" "}
              among the strongest secondary
              responses.
            </>
          )}
        </p>

        <button>
          VIEW PATHWAYS
          <ArrowUpRight size={14} />
        </button>
      </section>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  description
}) {
  return (
    <article className="metric">
      <div>
        {icon}
        <span>{label}</span>
      </div>

      <strong>{value}</strong>

      <p>{description}</p>
    </article>
  );
}

export default App;

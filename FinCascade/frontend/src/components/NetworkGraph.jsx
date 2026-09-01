import { useEffect, useMemo, useRef } from "react";
import ForceGraph2D from "react-force-graph-2d";

export default function NetworkGraph({
  network,
  impacts = [],
  selectedNode,
  onNodeSelect
}) {
  const graphRef = useRef();

  const impactMap = useMemo(() => {
    const map = {};

    impacts.forEach((item) => {
      map[item.ticker] = Number(item.shock_pct || 0);
    });

    return map;
  }, [impacts]);


  const graphData = useMemo(() => {
    if (!network) {
      return {
        nodes: [],
        links: []
      };
    }

    return {
      nodes: network.nodes.map((node) => ({
        ...node
      })),

      links: network.edges.map((edge) => ({
        ...edge,
        source: edge.source,
        target: edge.target
      }))
    };
  }, [network]);


  useEffect(() => {
    if (!graphRef.current || !network) {
      return;
    }

    const fg = graphRef.current;

    // Spread nodes much further apart
    const charge = fg.d3Force("charge");

    if (charge) {
      charge
        .strength(-520)
        .distanceMax(700);
    }

    // Increase financial-link distance
    const linkForce = fg.d3Force("link");

    if (linkForce) {
      linkForce
        .distance((link) => {
          const weight = Math.abs(
            Number(link.weight || 0)
          );

          // Stronger links slightly closer,
          // weaker links further apart
          return 105 + (1 - Math.min(weight, 1)) * 55;
        })
        .strength(0.28);
    }

    fg.d3ReheatSimulation();

    const timer = setTimeout(() => {
      try {
        fg.zoomToFit(900, 85);
      } catch (error) {
        console.log("Graph fit skipped");
      }
    }, 1300);

    return () => clearTimeout(timer);

  }, [network]);


  useEffect(() => {
    if (!graphRef.current) return;

    const timer = setTimeout(() => {
      try {
        graphRef.current.zoomToFit(
          600,
          85
        );
      } catch (error) {
        console.log("Scenario graph fit skipped");
      }
    }, 400);

    return () => clearTimeout(timer);

  }, [impacts]);


  const getImpact = (node) =>
    impactMap[node.id] || 0;


  const getNodeColor = (node) => {
    const impact = getImpact(node);

    if (impact <= -5) {
      return "#d94b43";
    }

    if (impact < -0.5) {
      return "#ee8f7e";
    }

    if (impact >= 5) {
      return "#43b878";
    }

    if (impact > 0.5) {
      return "#8edcaf";
    }

    if (
      selectedNode?.id === node.id
    ) {
      return "#d9ff68";
    }

    return "#16382c";
  };


  const getNodeRadius = (node) => {
    const impact = Math.abs(
      getImpact(node)
    );

    const pagerank = Number(
      node.pagerank || 0
    );

    return Math.min(
      18,
      6.5 +
      impact * 0.30 +
      pagerank * 60
    );
  };


  const shouldShowLabel = (
    node,
    scale
  ) => {
    const impact = Math.abs(
      getImpact(node)
    );

    if (
      selectedNode?.id === node.id
    ) {
      return true;
    }

    // Always label meaningfully affected nodes
    if (impact >= 0.5) {
      return true;
    }

    // Show all labels only after zooming in
    return scale > 2.0;
  };


  const drawNode = (
    node,
    ctx,
    globalScale
  ) => {

    const radius =
      getNodeRadius(node);

    const impact =
      getImpact(node);


    // subtle halo for affected nodes
    if (Math.abs(impact) >= 0.5) {

      ctx.beginPath();

      ctx.arc(
        node.x,
        node.y,
        radius + 5,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        impact < 0
          ? "rgba(217,75,67,0.10)"
          : "rgba(67,184,120,0.12)";

      ctx.fill();
    }


    ctx.beginPath();

    ctx.arc(
      node.x,
      node.y,
      radius,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      getNodeColor(node);

    ctx.fill();


    ctx.strokeStyle =
      "rgba(22,56,44,0.25)";

    ctx.lineWidth = 1.3;

    ctx.stroke();


    if (
      shouldShowLabel(
        node,
        globalScale
      )
    ) {

      const label =
        node.name || node.id;

      const fontSize =
        Math.max(
          10,
          13 / Math.sqrt(
            globalScale
          )
        );

      ctx.font =
        `600 ${fontSize}px Inter, sans-serif`;

      ctx.textAlign =
        "center";

      ctx.textBaseline =
        "top";

      ctx.fillStyle =
        "#16382c";


      ctx.fillText(
        label,
        node.x,
        node.y + radius + 5
      );


      // Show impact for affected nodes
      if (Math.abs(impact) >= 0.5) {

        const impactText =
          `${impact > 0 ? "+" : ""}${impact.toFixed(1)}%`;

        ctx.font =
          `600 ${Math.max(
            9,
            11 / Math.sqrt(
              globalScale
            )
          )}px Inter, sans-serif`;

        ctx.fillStyle =
          impact < 0
            ? "#b8433d"
            : "#31865a";


        ctx.fillText(
          impactText,
          node.x,
          node.y +
            radius +
            5 +
            fontSize +
            3
        );
      }
    }
  };


  return (
    <div className="network-canvas">

      <ForceGraph2D
        ref={graphRef}

        graphData={graphData}

        backgroundColor="rgba(0,0,0,0)"

        nodeCanvasObject={
          drawNode
        }

        nodePointerAreaPaint={(
          node,
          color,
          ctx
        ) => {

          ctx.beginPath();

          ctx.arc(
            node.x,
            node.y,
            getNodeRadius(node) + 6,
            0,
            Math.PI * 2
          );

          ctx.fillStyle = color;

          ctx.fill();
        }}

        linkColor={() =>
          "rgba(22,56,44,0.16)"
        }

        linkWidth={(link) => {
          const weight =
            Math.abs(
              Number(
                link.weight || 0
              )
            );

          return Math.max(
            0.8,
            weight * 2.2
          );
        }}

        linkDirectionalArrowLength={3.5}

        linkDirectionalArrowRelPos={0.92}

        cooldownTicks={180}

        warmupTicks={80}

        d3AlphaDecay={0.018}

        d3VelocityDecay={0.34}

        enableNodeDrag={true}

        enableZoomInteraction={true}

        enablePanInteraction={true}

        onNodeClick={(node) => {

          onNodeSelect?.(node);

          graphRef.current?.centerAt(
            node.x,
            node.y,
            500
          );

          graphRef.current?.zoom(
            3.1,
            500
          );
        }}

        onNodeDragEnd={(node) => {
          node.fx = node.x;
          node.fy = node.y;
        }}

        onEngineStop={() => {

          try {

            graphRef.current?.zoomToFit(
              700,
              85
            );

          } catch (error) {

            console.log(
              "Final graph fit skipped"
            );
          }
        }}
      />

    </div>
  );
}

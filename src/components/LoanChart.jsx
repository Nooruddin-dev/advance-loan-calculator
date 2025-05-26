import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { useLayoutEffect } from "react";

export default function LoanChart({ schedule }) {
  useLayoutEffect(() => {
    const root = am5.Root.new("loanChartDiv");
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo.dispose();

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true, panY: true, wheelX: "panX", wheelY: "zoomX",
        layout: root.verticalLayout
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "id",
        renderer: am5xy.AxisRendererX.new(root, {})
      })
    );

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {})
      })
    );

    const createSeries = (field, name, colorHex) => {
        const series = chart.series.push(
            am5xy.ColumnSeries.new(root, {
              name,
              xAxis,
              yAxis,
              valueYField: field,
              categoryXField: "id",
              stacked: true,
            })
          );
          series.columns.template.setAll({
            tooltipText: "{name}: {valueY}",
            fill: am5.color(colorHex),
            stroke: am5.color(colorHex),
            width: am5.percent(90),
          });
          return series;
    };

    const data = schedule.map(row => ({
      id: row.id.toString(),
      principal: parseFloat(row.principal),
      interest: parseFloat(row.interest),
      penalty: parseFloat(row.penalty)
    }));

    xAxis.data.setAll(data);
    createSeries("principal", "Principal","#cf8e56").data.setAll(data);
    createSeries("interest", "Interest", "#533922").data.setAll(data);
    createSeries("penalty", "Penalty", "#6f4e7c").data.setAll(data);

    return () => root.dispose();
  }, [schedule]);

  return <div id="loanChartDiv" style={{ width: "100%", height: "400px" }}></div>;
}

<template>
  <div
    class="dashboard"
    :class="{ 'dark-mode': isDarkMode }"
  >
    <div class="status-indicator-container">
      <div class="status-indicator">
        <div class="status-item">
          <div class="status-dot"></div>
          <span>系统在线</span>
        </div>
        <div class="status-item">
          <div class="status-dot online"></div>
          <span>实时监控</span>
        </div>
      </div>
    </div>

    <!-- 深色模式切换按钮 -->
    <div class="theme-toggle">
      <a-button
        :icon="isDarkMode ? h('span', '☀️') : h('span', '🌙')"
        @click="toggleTheme"
        class="toggle-btn"
        :type="isDarkMode ? 'primary' : 'default'"
      >
        {{ isDarkMode ? '浅色模式' : '深色模式' }}
      </a-button>
      <a-button
        :icon="isFullscreen ? h('span', '🗗') : h('span', '⛶')"
        @click="toggleFullscreen"
        class="toggle-btn"
        :type="isFullscreen ? 'primary' : 'default'"
      >
        {{ isFullscreen ? '退出全屏' : '全屏模式' }}
      </a-button>
    </div>

    <!-- 科技感标题 -->
    <div
      class="dashboard-header"
      :class="{ fullscreen: isFullscreen }"
    >
      <h1 class="title-text">VMI仓电机全检数字化平台</h1>
    </div>

    <!-- 顶部控制和统计区域 -->
    <div class="dashboard-controls">
      <div class="time-selector">
        <span class="control-label">时间范围：</span>
        <a-date-picker
          v-model:value="startDate"
          placeholder="开始时间"
          :class="{ 'dark-picker': isDarkMode }"
        />
        <span class="time-separator">至</span>
        <a-date-picker
          v-model:value="endDate"
          placeholder="结束时间"
          :class="{ 'dark-picker': isDarkMode }"
        />
        <a-button
          type="primary"
          @click="handleManualRefresh"
          class="refresh-btn"
          :loading="loading"
        >
          {{ loading ? '刷新中...' : '刷新数据' }}
        </a-button>
      </div>
      <div class="stats-display">
        <div class="stat-item">
          <div class="stat-value">{{ totalCompleted }}</div>
          <div class="stat-label">总完成量</div>
        </div>
        <div class="stat-item">
          <div class="stat-value qualified">{{ qualifiedCount }}</div>
          <div class="stat-label">合格数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value unqualified">{{ unqualifiedCount }}</div>
          <div class="stat-label">不合格数</div>
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <a-alert
      v-if="error"
      :message="error"
      type="error"
      show-icon
      closable
      @close="clearError"
      style="margin-bottom: 16px;"
    />

    <a-row :gutter="[16, 16]">
      <!-- 第一行 -->
      <a-col :span="8">
        <!-- 合格率和完工率上下排布 -->
        <div class="vertical-charts">
          <CustomCard
            title="合格率"
            :isDarkMode="isDarkMode"
            class="chart-card-half"
          >
            <v-chart
              ref="qualityRateChart"
              :option="qualityRateOption"
              class="chart-half"
            />
          </CustomCard>
          <CustomCard
            title="完工率"
            :isDarkMode="isDarkMode"
            class="chart-card-half"
          >
            <v-chart
              ref="completionRateChart"
              :option="completionRateOption"
              class="chart-half"
            />
          </CustomCard>
        </div>
      </a-col>
      <a-col :span="8">
        <CustomCard
          title="不良类型分布"
          :isDarkMode="isDarkMode"
          class="chart-card"
        >
          <v-chart
            ref="defectTypeChart"
            :option="defectTypeOption"
            class="chart"
          />
        </CustomCard>
      </a-col>
      <a-col :span="8">
        <CustomCard
          title="厂家不良趋势"
          :isDarkMode="isDarkMode"
          class="chart-card"
        >
          <v-chart
            ref="manufacturerTrendChart"
            :option="manufacturerTrendOption"
            class="chart"
          />
        </CustomCard>
      </a-col>
    </a-row>

    <!-- 第二行：绝缘耐压、电阻不良、反电动势、外观、噪音 -->
    <CustomCard
      :isDarkMode="isDarkMode"
      class="charts-container-card"
    >
      <div class="charts-row">
        <div class="chart-item">
          <div class="chart-header">铭牌不良</div>
          <v-chart
            ref="tagChart"
            :option="tagOption"
            class="chart"
          />
        </div>
        <div class="chart-item">
          <div class="chart-header">端子变形</div>
          <v-chart
            ref="terminalChart"
            :option="terminalOption"
            class="chart"
          />
        </div>
        <div class="chart-item">
          <div class="chart-header">外观不良</div>
          <v-chart
            ref="appearanceChart"
            :option="appearanceOption"
            class="chart"
          />
        </div>
        <div class="chart-item">
          <div class="chart-header">轴承噪音</div>
          <v-chart
            ref="noiseChart"
            :option="noiseOption"
            class="chart"
          />
        </div>
      </div>
    </CustomCard>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, h, computed } from "vue";
import VChart from "vue-echarts";
import CustomCard from "@/components/CustomCard.vue";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { PieChart, LineChart, BarChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from "echarts/components";
import { useDashboard } from "./useDashboard";

import moment from "moment";
moment.locale("zh-cn");

// 使用dashboard hook
const {
  loading,
  error,
  dashboardData,
  startDate,
  endDate,
  fetchDashboardData,
  refreshData,
  getQualityRateChartData,
  getDefectTypeChartData,
  getManufacturerTrendData,
  getManufacturerTrendXAxis,
  getDefectTrendChartData,
  getCompletionRateData,
  clearError,
} = useDashboard();

use([
  CanvasRenderer,
  PieChart,
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
]);

// 深色模式状态
const isDarkMode = ref(false);

// 全屏模式状态
const isFullscreen = ref(false);

// 定时器引用
const refreshTimer = ref<NodeJS.Timeout | null>(null);

// 上一次请求是否成功的标志
const lastRequestSuccess = ref(true);

// 计算属性：统计数据
const totalCompleted = computed(() => dashboardData.stats.totalCompleted);
const qualifiedCount = computed(() => dashboardData.stats.qualifiedCount);
const unqualifiedCount = computed(() => dashboardData.stats.unqualifiedCount);

// 切换主题函数
const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
  localStorage.setItem("dashboard-dark-mode", isDarkMode.value.toString());
};

// 全屏切换函数
const toggleFullscreen = () => {
  if (!isFullscreen.value) {
    // 进入全屏
    const element = document.querySelector(".dashboard") as HTMLElement;
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if ((element as any).webkitRequestFullscreen) {
      // Safari
      (element as any).webkitRequestFullscreen();
    } else if ((element as any).msRequestFullscreen) {
      // IE11
      (element as any).msRequestFullscreen();
    }
  } else {
    // 退出全屏
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      // Safari
      (document as any).webkitExitFullscreen();
    } else if ((document as any).msExitFullscreen) {
      // IE11
      (document as any).msExitFullscreen();
    }
  }
};

// 监听全屏状态变化
const handleFullscreenChange = () => {
  isFullscreen.value = !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).msFullscreenElement
  );
};

// 启动自动刷新定时器
const startAutoRefresh = () => {
  // 清除现有定时器
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value);
  }
  // 根据上一次请求状态决定刷新间隔
  // 成功：30秒，失败：1分钟
  const interval = lastRequestSuccess.value ? 30000 : 60000;
  refreshTimer.value = setInterval(async () => {
    const success = await fetchDashboardData();
    lastRequestSuccess.value = success;
    // 根据本次请求结果，重新设置定时器间隔
    startAutoRefresh();
  }, interval);
};

// 停止自动刷新定时器
const stopAutoRefresh = () => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value);
    refreshTimer.value = null;
  }
};

// 手动刷新处理函数
const handleManualRefresh = async () => {
  // 停止当前定时器
  stopAutoRefresh();
  // 执行刷新并获取结果
  const success = await refreshData();
  lastRequestSuccess.value = success;

  // 重新启动定时器（会根据lastRequestSuccess自动选择间隔）
  startAutoRefresh();
};

// 图表引用
const qualityRateChart = ref();
const completionRateChart = ref();
const defectTypeChart = ref();
const manufacturerTrendChart = ref();
const terminalChart = ref();
const tagChart = ref();
const appearanceChart = ref();
const noiseChart = ref();

// 所有图表的引用数组
const allCharts = [
  qualityRateChart,
  completionRateChart,
  defectTypeChart,
  manufacturerTrendChart,
  terminalChart,
  tagChart,
  appearanceChart,
  noiseChart,
];

// 合格率饼图配置
const qualityRateOption = computed(() => ({
  tooltip: {
    trigger: "item",
    formatter: "{a} <br/>{b}: {c}% ({d}%)",
  },
  legend: {
    orient: "horizontal",
    bottom: 5,
    left: "center",
    itemGap: 20,
    textStyle: {
      color: isDarkMode.value ? "#ffffff" : "#333333",
    },
  },
  series: [
    {
      name: "合格率",
      type: "pie",
      radius: ["25%", "55%"],
      center: ["50%", "40%"],
      avoidLabelOverlap: false,
      label: {
        show: true,
        position: "outside",
        formatter: "{b}: {d}%",
        fontSize: 10,
        fontWeight: "bold",
        color: isDarkMode.value ? "#ffffff" : "#333333",
      },
      labelLine: {
        show: true,
        length: 8,
        length2: 5,
      },
      emphasis: {
        label: {
          show: true,
          fontSize: "16",
          fontWeight: "bold",
        },
      },
      data: getQualityRateChartData(),
    },
  ],
}));

// 完工率柱状图配置
const completionRateOption = computed(() => {
  const completionData = getCompletionRateData();
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      formatter: "{a} <br/>{b}: {c}%",
    },
    grid: {
      left: "15%",
      right: "8%",
      bottom: "15%",
      top: "15%",
      containLabel: true,
    },
    xAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLabel: {
        formatter: "{value}%",
        fontSize: 9,
        color: isDarkMode.value ? "#ffffff" : "#333333",
      },
    },
    yAxis: {
      type: "category",
      data: completionData.yAxis,
      axisLabel: {
        fontSize: 9,
        color: isDarkMode.value ? "#ffffff" : "#333333",
      },
    },
    series: [
      {
        name: "完工率",
        type: "bar",
        data: completionData.series[0].data,
        itemStyle: completionData.series[0].itemStyle,
        label: {
          show: true,
          position: "right",
          formatter: "{c}%",
          fontSize: 9,
        },
      },
    ],
  };
});

// 不良类型分布饼图配置
const defectTypeOption = computed(() => ({
  tooltip: {
    trigger: "item",
    formatter: "{a} <br/>{b}: {c}% ({d}%)",
  },
  legend: {
    orient: "vertical",
    left: "left",
    textStyle: {
      color: isDarkMode.value ? "#ffffff" : "#333333",
    },
  },
  series: [
    {
      name: "不良类型",
      type: "pie",
      radius: "70%",
      data: getDefectTypeChartData(),
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: "rgba(0, 0, 0, 0.5)",
        },
      },
    },
  ],
}));

// 厂家不良趋势折线图配置
const manufacturerTrendOption = computed(() => ({
  tooltip: {
    trigger: "axis",
  },
  legend: {
    data: Object.keys(dashboardData.manufacturerTrends),
    textStyle: {
      color: isDarkMode.value ? "#ffffff" : "#333333",
    },
  },
  grid: {
    left: "3%",
    right: "4%",
    bottom: "3%",
    containLabel: true,
  },
  xAxis: {
    type: "category",
    boundaryGap: false,
    data: getManufacturerTrendXAxis(),
    axisLabel: {
      color: isDarkMode.value ? "#ffffff" : "#333333",
    },
  },
  yAxis: {
    type: "value",
    axisLabel: {
      formatter: "{value}%",
      color: isDarkMode.value ? "#ffffff" : "#333333",
    },
  },
  series: getManufacturerTrendData(),
}));

// 生成折线图数据的通用函数
const generateLineChartOption = (
  type: keyof typeof dashboardData.defectTrends
) => {
  const trendData = getDefectTrendChartData(type);
  return {
    tooltip: {
      trigger: "axis",
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: trendData.xAxis,
      axisLabel: {
        color: isDarkMode.value ? "#ffffff" : "#333333",
      },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        formatter: "{value}个",
        color: isDarkMode.value ? "#ffffff" : "#333333",
      },
    },
    series: trendData.series,
  };
};

// 各项指标的折线图配置
const terminalOption = computed(() => generateLineChartOption("terminal"));
const tagOption = computed(() => generateLineChartOption("tag"));
const appearanceOption = computed(() => generateLineChartOption("appearance"));
const noiseOption = computed(() => generateLineChartOption("noise"));

// 防抖函数
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// 处理窗口resize事件
const handleResize = debounce(() => {
  nextTick(() => {
    allCharts.forEach((chartRef) => {
      if (chartRef.value) {
        chartRef.value.resize();
      }
    });
  });
}, 200);

onMounted(async () => {
  // 从localStorage恢复深色模式设置
  const savedDarkMode = localStorage.getItem("dashboard-dark-mode");
  if (savedDarkMode) {
    isDarkMode.value = savedDarkMode === "true";
  }

  // 初始化时获取数据
  const success = await fetchDashboardData();
  lastRequestSuccess.value = success;
  console.log("Dashboard mounted");

  // 启动自动刷新定时器
  startAutoRefresh();

  // 添加resize监听器
  window.addEventListener("resize", handleResize);

  // 添加全屏状态变化监听器
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  document.addEventListener("msfullscreenchange", handleFullscreenChange);
});

onUnmounted(() => {
  // 停止自动刷新定时器
  stopAutoRefresh();

  // 移除resize监听器
  window.removeEventListener("resize", handleResize);

  // 移除全屏状态变化监听器
  document.removeEventListener("fullscreenchange", handleFullscreenChange);
  document.removeEventListener(
    "webkitfullscreenchange",
    handleFullscreenChange
  );
  document.removeEventListener("msfullscreenchange", handleFullscreenChange);
});
</script>

<style scoped>
.dashboard {
  padding: 20px;
  position: relative;
  transition: all 0.3s ease;
}

/* 全屏模式样式 */
.dashboard:fullscreen {
  padding: 10px;
  background-color: #f0f2f5;
}

.dashboard:fullscreen.dark-mode {
  background-color: #0a1929;
}

/* WebKit 全屏样式 */
.dashboard:-webkit-full-screen {
  padding: 10px;
  background-color: #f0f2f5;
}

.dashboard:-webkit-full-screen.dark-mode {
  background-color: #0a1929;
}

/* MS 全屏样式 */
.dashboard:-ms-fullscreen {
  padding: 10px;
  background-color: #f0f2f5;
}

.dashboard:-ms-fullscreen.dark-mode {
  background-color: #0a1929;
}

/* 深色模式样式 */
.dashboard.dark-mode {
  background-color: #0a1929;
  color: #ffffff;
}

.dashboard.dark-mode .status-item {
  color: #e0e0e0;
}

.dashboard.dark-mode .title-text {
  background: linear-gradient(135deg, #00d0ff, #08f1c3, #a3f1ff);
  background-size: 200% 200%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.dashboard.dark-mode .title-subtitle {
  color: #b0b0b0;
}

/* 主题切换按钮样式 */
.theme-toggle {
  position: fixed;
  flex-direction: column;
  display: flex;
  gap: 10px;
  bottom: 20px;
  left: 60px;
  z-index: 1000;
}

.toggle-btn {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.toggle-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* 状态指示器容器 */
.status-indicator-container {
  position: absolute;
  top: 20px;
  right: 30px;
  z-index: 999;
}

.dashboard-header.fullscreen {
  margin-top: 3ch;
}

/* 科技感标题样式 */
.dashboard-header {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  margin-bottom: 20px;
  margin-top: 30px;
  position: relative;
  text-align: center;
  background-image: url("@/assets/titleBg.png");
  background-size: 80% 80%;
  background-position: center;
  background-repeat: no-repeat;
  padding: 30px 20px;
}

.title-text {
  font-size: 32px;
  font-weight: 700;
  background: linear-gradient(135deg, #00d0ff, #08f1c3, #a3f1ff);
  background-size: 200% 200%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradientShift 3s ease-in-out infinite;
  margin: 0;
  line-height: 1.2;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 2;
}

.dashboard.dark-mode .title-subtitle {
  color: #b0b0b0;
}

.title-decoration {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.status-indicator {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: center;
  margin-top: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #595959;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #52c41a;
  position: relative;
}

.status-dot.online::after {
  content: "";
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border: 2px solid #52c41a;
  border-radius: 50%;
  animation: pulse-ring 2s infinite;
}

/* 动画效果 */
@keyframes gradientShift {
  0%,
  100% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.1);
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}

@keyframes pulse-ring {
  0% {
    opacity: 1;
    transform: scale(1);
  }

  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

.charts-container-card {
  margin-top: 16px;
  background: #ffffff;
  border-radius: 12px;
  border: 2px solid #f0f0f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
}

.chart-header {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #ffffff;
  background: linear-gradient(90deg, #14377a, #51a6d7);
  padding: 4px 12px;
  border-radius: 6px;
}

.chart-card {
  height: 400px;
  width: 100%;
}

.chart {
  height: 300px;
  width: 100%;
}

/* 垂直排布的图表容器 */
.vertical-charts {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 400px;
}

.chart-card-half {
  flex: 1;
  min-height: 120px;
  width: 100%;
}

.chart-half {
  height: 120px;
  width: 100%;
}

/* Flex布局的第二行样式 */
.charts-row {
  display: flex;
  gap: 16px;
  margin-top: 16px;
  width: 100%;
}

.chart-item {
  flex: 1;
  min-width: 0;
  /* 防止flex项目过宽 */
}

.chart-item .chart-card {
  height: 350px;
  width: 100%;
}

.chart-item .chart {
  height: 250px;
  width: 100%;
}

/* 确保图表在小屏幕上的响应式 */
@media (max-width: 1200px) {
  .charts-row {
    flex-wrap: wrap;
  }

  .chart-item {
    flex: 0 0 calc(50% - 8px);
    margin-bottom: 16px;
  }
}

@media (max-width: 768px) {
  .chart-item {
    flex: 0 0 100%;
  }
}

/* 顶部控制和统计区域 */
.dashboard-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 15px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
}

.dashboard.dark-mode .dashboard-controls {
  background: #0c1f35cc;
  border-color: #12689d;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.time-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.control-label {
  font-weight: 600;
  color: #262626;
  white-space: nowrap;
}

.dashboard.dark-mode .control-label {
  color: #ffffff;
}

.time-separator {
  color: #8c8c8c;
  margin: 0 4px;
}

.dashboard.dark-mode .time-separator {
  color: #ffffff;
}

.refresh-btn {
  margin-left: 8px;
  color: #0efcff;
  border: 1px solid #0efcff;
  background-color: transparent;
}

.stats-display {
  display: flex;
  gap: 32px;
  align-items: center;
}

.stat-item {
  text-align: center;
  min-width: 80px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 4px;
  color: #1890ff;
  text-shadow: 0 0 10px rgba(24, 144, 255, 0.3);
}

.stat-value.qualified {
  color: #52c41a;
  text-shadow: 0 0 10px rgba(82, 196, 26, 0.3);
}

.stat-value.unqualified {
  color: #ff4d4f;
  text-shadow: 0 0 10px rgba(255, 77, 79, 0.3);
}

.dashboard.dark-mode .stat-value {
  color: #0efcff;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
}

.dashboard.dark-mode .stat-value.qualified {
  color: #0efcff;
  text-shadow: 0 0 10px rgba(82, 196, 26, 0.4);
}

.dashboard.dark-mode .stat-value.unqualified {
  color: #ff4d4f;
  text-shadow: 0 0 10px rgba(255, 77, 79, 0.4);
}

.stat-label {
  font-size: 14px;
  color: #8c8c8c;
  font-weight: 500;
}

.dashboard.dark-mode .stat-label {
  color: #0efcff;
}

/* 深色模式下的日期选择器样式 */
.dashboard.dark-mode :deep(.ant-picker) {
  background-color: #0c1f35cc;
  border-color: #12689d;
  color: #ffffff;
}

.dashboard.dark-mode :deep(.ant-picker-input > input) {
  color: #ffffff;
  background-color: transparent;
}

.dashboard.dark-mode :deep(.ant-picker-suffix) {
  color: #ffffff;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .dashboard-controls {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .time-selector {
    justify-content: center;
  }

  .stats-display {
    justify-content: center;
    gap: 24px;
  }
}

@media (max-width: 768px) {
  .stats-display {
    gap: 16px;
  }

  .stat-item {
    min-width: 60px;
  }

  .stat-value {
    font-size: 24px;
  }
}
</style>

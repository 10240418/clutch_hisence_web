import { getDashboardStats } from '@/httpapis/management'
import dayjs from 'dayjs'
import { ref, reactive } from 'vue'

// 后台返回的数据结构
export interface ApiResponse {
  qualityRate: {
    qualifiedCount: number
    defectCount: number
    totalCount: number
    qualityRate: number
  }
  defectTypeDistribution: Array<{
    type: string
    count: number
    rate: number
  }>
  supplierDefectTrend: Array<{
    supplierName: string
    dailyData: Array<{
      date: string
      defectRate: number
      totalCount: number
      defectCount: number
    }>
  }>
  defectTrendByType: {
    terminalData: Array<{ date: string; count: number }> | null
    tagData: Array<{ date: string; count: number }> | null
    appearanceData: Array<{ date: string; count: number }> | null
    noiseData: Array<{ date: string; count: number }> | null
  }
}

export interface DashboardData {
  qualityRate: {
    qualified: number
    unqualified: number
  }
  defectTypes: {
    terminal: number
    tag: number
    appearance: number
    noise: number
  }
  manufacturerTrends: {
    [key: string]: number[]
  }
  defectTrends: {
    terminal: number[]
    tag: number[]
    appearance: number[]
    noise: number[]
  }
  // 新增统计数据
  stats: {
    totalCompleted: number
    qualifiedCount: number
    unqualifiedCount: number
  }
  // 新增日期范围
  dateRange: string[]
}

export const useDashboard = () => {
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 时间选择器 - 默认为七天前到当天
  const startDate = ref<dayjs.Dayjs>(dayjs().subtract(7, 'day'))
  const endDate = ref<dayjs.Dayjs>(dayjs())

  // 模拟数据作为初始值
  const dashboardData = reactive<DashboardData>({
    qualityRate: {
      qualified: 95.5,
      unqualified: 4.5
    },
    defectTypes: {
      terminal: 35,
      tag: 25,
      appearance: 25,
      noise: 15
    },
    manufacturerTrends: {
      '厂家A': [5.2, 4.8, 3.9, 4.1, 3.5, 3.2],
      '厂家B': [6.1, 5.5, 4.8, 5.2, 4.9, 4.3],
      '厂家C': [4.3, 3.8, 3.5, 3.1, 2.9, 2.7]
    },
    defectTrends: {
      terminal: [12, 8, 15, 10, 6, 9],
      tag: [8, 6, 12, 7, 4, 6],
      appearance: [6, 4, 9, 5, 3, 4],
      noise: [5, 3, 7, 4, 2, 3]
    },
    stats: {
      totalCompleted: 49,
      qualifiedCount: 47,
      unqualifiedCount: 2
    },
    dateRange: Array.from({ length: 8 }, (_, i) =>
      dayjs().subtract(7 - i, 'day').format('M月D日')
    )
  })

  // 数据转换函数
  const transformApiData = (apiData: ApiResponse): void => {
    // 更新质量率
    dashboardData.qualityRate.qualified = apiData.qualityRate.qualityRate
    dashboardData.qualityRate.unqualified = 100 - apiData.qualityRate.qualityRate

    // 更新统计数据
    dashboardData.stats.totalCompleted = apiData.qualityRate.totalCount
    dashboardData.stats.qualifiedCount = apiData.qualityRate.qualifiedCount
    dashboardData.stats.unqualifiedCount = apiData.qualityRate.defectCount

    // 根据选择的日期范围创建日期数组
    const createDateRange = (): string[] => {
      const start = startDate.value || dayjs().subtract(7, 'day')
      const end = endDate.value || dayjs()
      const dates: string[] = []

      let current = start
      while (current.valueOf() <= end.valueOf()) {
        dates.push(current.format('M月D日'))
        current = current.add(1, 'day')
      }

      return dates
    }

    const dateRange = createDateRange()

    // 创建日期到索引的映射
    const getDateIndex = (dateStr: string): number => {
      const date = dayjs(dateStr)
      const start = startDate.value || dayjs().subtract(7, 'day')
      const diffDays = date.diff(start, 'day')
      return diffDays >= 0 && diffDays < dateRange.length ? diffDays : -1
    }

    // 重置不良类型数据
    dashboardData.defectTypes = {
      terminal: 0,
      tag: 0,
      appearance: 0,
      noise: 0
    }

    // 更新不良类型分布
    if (apiData.defectTypeDistribution == null) {
      dashboardData.defectTypes = {
        terminal: 0,
        tag: 0,
        appearance: 0,
        noise: 0
      }
    } else {
      apiData.defectTypeDistribution.forEach(item => {
        switch (item.type) {
          case '端子变形':
            dashboardData.defectTypes.terminal = item.rate
            break
          case '铭牌不良':
            dashboardData.defectTypes.tag = item.rate
            break
          case '外观不良':
            dashboardData.defectTypes.appearance = item.rate
            break
          case '轴承噪音':
            dashboardData.defectTypes.noise = item.rate
            break
        }
      })
    }

    // 更新供应商不良趋势（转换为厂家趋势）
    dashboardData.manufacturerTrends = {}
    if (apiData.supplierDefectTrend == null) {
      // 如果没有数据，创建空的趋势数据
      dashboardData.manufacturerTrends = {}
    } else {
      apiData.supplierDefectTrend.forEach(supplier => {
        // 为每个供应商创建按日期范围的数据数组，初始值为0
        const trendData = new Array(dateRange.length).fill(0)

        // 将实际数据按日期映射到相应位置
        supplier.dailyData.forEach(dayData => {
          const index = getDateIndex(dayData.date)
          if (index !== -1) {
            trendData[index] = dayData.defectRate
          }
        })

        dashboardData.manufacturerTrends[supplier.supplierName] = trendData
      })
    }

    // 更新各类型不良趋势
    const { defectTrendByType } = apiData

    // 初始化所有类型的趋势数据为0填充的数组
    const initTrendData = () => new Array(dateRange.length).fill(0)

    dashboardData.defectTrends = {
      terminal: initTrendData(),
      tag: initTrendData(),
      appearance: initTrendData(),
      noise: initTrendData()
    }

    // 处理端子变形数据
    if (defectTrendByType.terminalData) {
      defectTrendByType.terminalData.forEach(item => {
        const index = getDateIndex(item.date)
        if (index !== -1) {
          dashboardData.defectTrends.terminal[index] = item.count
        }
      })
    }

    // 处理铭牌不良数据
    if (defectTrendByType.tagData) {
      defectTrendByType.tagData.forEach(item => {
        const index = getDateIndex(item.date)
        if (index !== -1) {
          dashboardData.defectTrends.tag[index] = item.count
        }
      })
    }

    // 处理外观数据
    if (defectTrendByType.appearanceData) {
      defectTrendByType.appearanceData.forEach(item => {
        const index = getDateIndex(item.date)
        if (index !== -1) {
          dashboardData.defectTrends.appearance[index] = item.count
        }
      })
    }

    // 处理轴承噪音数据
    if (defectTrendByType.noiseData) {
      defectTrendByType.noiseData.forEach(item => {
        const index = getDateIndex(item.date)
        if (index !== -1) {
          dashboardData.defectTrends.noise[index] = item.count
        }
      })
    }

    // 存储日期范围用于图表显示
    dashboardData.dateRange = dateRange
  }

  // 获取dashboard数据
  const fetchDashboardData = async (startDateParam?: string, endDateParam?: string): Promise<boolean> => {
    loading.value = true
    error.value = null

    try {
      const params = {
        startDate: startDateParam || startDate.value?.format('YYYY-MM-DD') || dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
        endDate: endDateParam || endDate.value?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD')
      }

      const response = await getDashboardStats(params)
      console.log('Fetched dashboard data:', response.data)

      // 转换API数据到dashboard数据结构
      if (response.data) {
        transformApiData(response.data.data)
      }

      // 请求成功，返回true
      return true

    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch dashboard data'
      console.error('Error fetching dashboard data:', err)
      // 请求失败，返回false
      return false
    } finally {
      loading.value = false
    }
  }

  // 刷新数据
  const refreshData = async (): Promise<boolean> => {
    return await fetchDashboardData()
  }


  // 更新质量率数据
  const updateQualityRate = (qualified: number, unqualified: number) => {
    dashboardData.qualityRate.qualified = qualified
    dashboardData.qualityRate.unqualified = unqualified
  }

  // 更新不良类型数据
  const updateDefectTypes = (types: Partial<DashboardData['defectTypes']>) => {
    Object.assign(dashboardData.defectTypes, types)
  }

  // 获取格式化的图表数据
  const getQualityRateChartData = () => [
    { value: dashboardData.qualityRate.qualified, name: '合格', itemStyle: { color: '#52c41a' } },
    { value: dashboardData.qualityRate.unqualified, name: '不合格', itemStyle: { color: '#ff4d4f' } }
  ]

  const getDefectTypeChartData = () => [
    { value: dashboardData.defectTypes.terminal, name: '端子变形', itemStyle: { color: '#1890ff' } },
    { value: dashboardData.defectTypes.tag, name: '铭牌不良', itemStyle: { color: '#722ed1' } },
    { value: dashboardData.defectTypes.appearance, name: '外观不良', itemStyle: { color: '#fa8c16' } },
    { value: dashboardData.defectTypes.noise, name: '轴承噪音', itemStyle: { color: '#52c41a' } }
  ]

  // 获取供应商不良趋势数据
  const getManufacturerTrendData = () => {
    return Object.entries(dashboardData.manufacturerTrends).map(([name, data], index) => {
      const colors = ['#1890ff', '#722ed1', '#fa8c16', '#52c41a', '#eb2f96']
      return {
        name,
        type: 'line',
        data,
        itemStyle: { color: colors[index % colors.length] }
      }
    })
  }

  // 获取不良趋势图表数据
  const getDefectTrendChartData = (type: keyof DashboardData['defectTrends']) => {
    const data = dashboardData.defectTrends[type] || []
    const xAxisData = dashboardData.dateRange.length > 0
      ? dashboardData.dateRange
      : ['1日', '2日', '3日', '4日', '5日', '6日']

    return {
      xAxis: xAxisData,
      series: [{
        type: 'line',
        data: data.length > 0 ? data : new Array(xAxisData.length).fill(0),
        itemStyle: { color: '#0efcff' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0, color: '#0efcff40' // 透明度40%
            }, {
              offset: 1, color: '#0efcff10' // 透明度10%
            }]
          }
        }
      }]
    }
  }

  // 获取厂家趋势图表的横轴数据
  const getManufacturerTrendXAxis = () => {
    return dashboardData.dateRange.length > 0
      ? dashboardData.dateRange
      : ['1日', '2日', '3日', '4日', '5日', '6日']
  }

  // 生成完工率数据（模拟数据，因为后台暂未开发）
  const getCompletionRateData = () => {
    return {
      yAxis: ['线体1', '线体2'],
      series: [{
        type: 'bar',
        data: [98.5, 97.2],
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#00d0ff' },
              { offset: 1, color: '#0080ff' }
            ]
          }
        }
      }]
    }
  }

  // 清除错误
  const clearError = () => {
    error.value = null
  }

  return {
    loading,
    error,
    dashboardData,
    startDate,
    endDate,
    fetchDashboardData,
    refreshData,
    updateQualityRate,
    updateDefectTypes,
    getQualityRateChartData,
    getDefectTypeChartData,
    getManufacturerTrendData,
    getManufacturerTrendXAxis,
    getDefectTrendChartData,
    getCompletionRateData,
    clearError
  }
}




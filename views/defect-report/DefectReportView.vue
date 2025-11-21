<script setup lang="ts">
import { onMounted, watch } from 'vue';
import dayjs from 'dayjs';
import { useDefectReportData } from './useDefectReport';

const {
    columns,
    pagination,
    dateRange,
    selectedSupplierId,
    selectedProductModelSN,
    data,
    isLoading,
    suppliers,
    list,
    loadSuppliers,
    resetFilters,
    exportToExcel
} = useDefectReportData();

// 防抖函数实现自动搜索
let searchTimeout: NodeJS.Timeout | null = null;

const autoSearch = () => {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    searchTimeout = setTimeout(() => {
        pagination.value.pageNum = 1;
        list();
    }, 500); // 500ms 延迟
};

// 监听时间范围变化，自动触发搜索
watch(dateRange, () => {
    autoSearch();
}, { deep: true });

// 监听供应商选择变化，自动触发搜索
watch(selectedSupplierId, () => {
    autoSearch();
});

// Note: Product model search is now triggered by search button, not auto-search

const onPageChange = () => {
    list();
};

const onReset = () => {
    resetFilters();
    list();
};

const onExport = () => {
    exportToExcel();
};

// Load data when component is mounted
onMounted(async () => {
    await loadSuppliers();
    list();
});
</script>

<template>
    <div>
        <!-- Basic Search and Action Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <a-range-picker v-model:value="dateRange" format="YYYY-MM-DD" :placeholder="['开始时间', '结束时间']" />

                <a-select v-model:value="selectedSupplierId" placeholder="选择供应商" allowClear style="width: 150px;">
                    <a-select-option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
                        {{ supplier.name }}
                    </a-select-option>
                </a-select>

                <a-input v-model:value="selectedProductModelSN" placeholder="输入产品型号"
                    style="width: 200px;" allowClear @pressEnter="autoSearch" />
                <a-button type="primary" @click="autoSearch">搜索</a-button>

            </div>

            <div style="display: flex; gap: 8px;">
                <a-button @click="onReset">重置筛选</a-button>
                <a-button type="primary" @click="onExport" :disabled="!data || data.length === 0">
                    导出Excel
                </a-button>
            </div>
        </div>

        <a-table :columns="columns" :data-source="data" :pagination="false" :loading="isLoading" :scroll="{ x: 800 }">
            <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'qualityDate'">
                    {{ record.qualityDate ? dayjs(record.qualityDate).format('YYYY-MM-DD HH:mm:ss') : '' }}
                </template>
                <template v-else-if="column.key === 'defectReason'">
                    <a-tag color="red">{{ record.defectReason || '未知' }}</a-tag>
                </template>
            </template>
        </a-table>

        <a-pagination class="mt15" v-model:current="pagination.pageNum" v-model:pageSize="pagination.pageSize"
            :total="pagination.total" show-size-changer @change="onPageChange"
            style="margin-top: 16px; text-align: right;" />
    </div>
</template>

<style scoped>
.mt15 {
    margin-top: 15px;
}
</style>

import { ref } from 'vue';
import { message } from 'ant-design-vue';
import dayjs, { Dayjs } from 'dayjs';
import ExcelJS from 'exceljs';
import { getCostReport } from '@/httpapis/management';

interface CostReportItem {
    supplierName: string;
    productModelSN: string;
    motorType: string;
    qualifiedCount: number;
    unqualifiedCount: number;
    totalCount: number;
    testDate: string;
}

interface CostReportQueryParams {
    pageNum: number | undefined;
    pageSize: number;
    supplierName?: string;
    productModelSN?: string;
    motorType?: string;
    startDate?: string;
    endDate?: string;
}

export const useCostReportData = () => {
    const isLoading = ref(false);
    const data = ref<CostReportItem[]>([]);
    const pagination = ref({
        pageNum: 1,
        pageSize: 10,
        total: 0,
    });

    // Filter parameters
    const dateRange = ref<[Dayjs, Dayjs] | []>([]);
    const inputSupplierName = ref<string>('');
    const inputProductModelSN = ref<string>('');
    const inputMotorType = ref<string>('');

    const columns = [
        {
            title: '供应商',
            dataIndex: 'supplierName',
            key: 'supplierName',
        },
        {
            title: '产品型号',
            dataIndex: 'motorType',
            key: 'motorType',
        },
        {
            title: '物料编码',
            dataIndex: 'productModelSN',
            key: 'productModelSN',
        },
        {
            title: '检测总数',
            dataIndex: 'totalCount',
            key: 'totalCount',
        },
        {
            title: '合格数量',
            dataIndex: 'qualifiedCount',
            key: 'qualifiedCount',
        },
        {
            title: '不合格数量',
            dataIndex: 'unqualifiedCount',
            key: 'unqualifiedCount',
        },
        {
            title: '检测日期',
            dataIndex: 'testDate',
            key: 'testDate',
            customRender: ({ text }: { text: string }) => text ? dayjs(text).format('YYYY-MM-DD') : '',
        },
    ];

    const buildQuery = (exportAll = false): CostReportQueryParams => {
        const query: CostReportQueryParams = {
            pageNum: exportAll ? undefined : pagination.value.pageNum,
            pageSize: exportAll ? -1 : pagination.value.pageSize,
        };

        if (inputSupplierName.value) query.supplierName = inputSupplierName.value.trim();
        if (inputProductModelSN.value) query.productModelSN = inputProductModelSN.value.trim();
        if (inputMotorType.value) query.motorType = inputMotorType.value.trim();

        if (dateRange.value && dateRange.value.length === 2) {
            query.startDate = dateRange.value[0].format('YYYY-MM-DD');
            query.endDate = dateRange.value[1].format('YYYY-MM-DD');
        }

        return query;
    };

    const list = async () => {
        isLoading.value = true;
        try {
            const response = await getCostReport(buildQuery());
            data.value = response.data.data || [];
            pagination.value.total = response.data.pagination?.total || 0;
        } catch (error: any) {
            message.error(`获取检测费用报表失败: ${error.response?.data?.error || error.message}`);
            return Promise.reject(error);
        } finally {
            isLoading.value = false;
        }
    };

    const resetFilters = () => {
        dateRange.value = [];
        inputSupplierName.value = '';
        inputProductModelSN.value = '';
        inputMotorType.value = '';
        pagination.value.pageNum = 1;
    };

    const exportToExcel = async () => {
        try {
            const response = await getCostReport(buildQuery(true));
            const allData: CostReportItem[] = response.data.data || [];

            if (!allData.length) {
                message.warning('没有数据可以导出');
                return;
            }

            // 创建工作簿
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('检测费用报表');

            // 设置列宽
            worksheet.columns = [
                { width: 25 }, // 厂家名称
                { width: 15 }, // 物料编码
                { width: 20 }, // 电机类型
                { width: 12 }, // 合格数量
                { width: 12 }, // 不合格数量
                { width: 12 }, // 检测总数
                { width: 15 }, // 检测日期
            ];

            // 计算汇总信息
            const totalTests = allData.reduce((sum, item) => sum + (item.totalCount || 0), 0);
            const totalQualified = allData.reduce((sum, item) => sum + (item.qualifiedCount || 0), 0);
            const totalUnqualified = allData.reduce((sum, item) => sum + (item.unqualifiedCount || 0), 0);
            const currentDate = dayjs().format('YYYY-MM-DD HH:mm:ss');

            // 添加汇总信息行
            worksheet.addRow(['检测总数:', `${totalTests}`, '', '', '', '', '']);
            worksheet.addRow(['合格/不合格:', `${totalQualified} / ${totalUnqualified}`, '', '', '', '', '']);
            worksheet.addRow(['导出日期:', currentDate, '', '', '', '', '']);
            worksheet.addRow(['', '', '', '', '', '', '']);
            worksheet.addRow(['厂家名称', '物料编码', '电机类型', '合格数量', '不合格数量', '检测总数', '检测日期']);

            // 添加数据行
            allData.forEach((item: CostReportItem) => {
                worksheet.addRow([
                    item.supplierName || '',
                    item.productModelSN || '',
                    item.motorType || '',
                    item.qualifiedCount || 0,
                    item.unqualifiedCount || 0,
                    item.totalCount || 0,
                    item.testDate ? dayjs(item.testDate).format('YYYY-MM-DD') : ''
                ]);
            });

            // 设置汇总信息行样式（前3行）
            for (let i = 1; i <= 3; i++) {
                const row = worksheet.getRow(i);
                row.height = 22;
                row.eachCell((cell, colNumber) => {
                    if (colNumber <= 2) {
                        cell.font = { bold: true, size: 12, color: { argb: '00000000' } };
                        cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'right' : 'left' };
                    }
                });
                // 合并第2-7列用于显示完整内容
                worksheet.mergeCells(`B${i}:G${i}`);
            }

            // 设置表头行样式（第5行）
            const headerRow = worksheet.getRow(5);
            headerRow.height = 25;
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, size: 12, color: { argb: '00000000' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE6F3FF' }
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: '00000000' } },
                    left: { style: 'thin', color: { argb: '00000000' } },
                    bottom: { style: 'thin', color: { argb: '00000000' } },
                    right: { style: 'thin', color: { argb: '00000000' } }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            // 设置数据行样式（从第6行开始）
            for (let i = 6; i <= worksheet.rowCount; i++) {
                const row = worksheet.getRow(i);
                row.height = 20;
                row.eachCell((cell) => {
                    cell.font = { size: 11, color: { argb: '00000000' } };
                    cell.border = {
                        top: { style: 'thin', color: { argb: '00000000' } },
                        left: { style: 'thin', color: { argb: '00000000' } },
                        bottom: { style: 'thin', color: { argb: '00000000' } },
                        right: { style: 'thin', color: { argb: '00000000' } }
                    };
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                });
            }

            // 生成文件名
            const fileName = `检测费用报表_${dayjs().format('YYYY-MM-DD')}.xlsx`;

            // 导出文件
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            message.success('导出成功');
        } catch (error: any) {
            console.error('导出错误:', error);
            message.error(`导出失败: ${error.message}`);
        }
    };

    return {
        isLoading,
        data,
        columns,
        pagination,
        dateRange,
        inputSupplierName,
        inputProductModelSN,
        inputMotorType,
        list,
        resetFilters,
        exportToExcel,
    };
};

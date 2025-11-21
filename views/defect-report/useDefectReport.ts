import { ref } from 'vue';
import { message } from 'ant-design-vue';
import dayjs, { Dayjs } from 'dayjs';
import { getDefectReport, getSuppliers } from '@/httpapis/management';
import ExcelJS from 'exceljs';

interface DefectReportItem {
    supplierName: string;
    qualityDate: string;
    productSN: string;
    productModelSN: string;
    batchNumber: string;
    defectReason: string;
    description?: string;
}

interface DefectReportQueryParams {
    pageNum: number | undefined;
    pageSize: number;
    startDate?: string;
    endDate?: string;
    supplierId?: number;
    description?: string;
}

export const useDefectReportData = () => {
    const isLoading = ref(false);
    const data = ref<DefectReportItem[]>([]);
    const suppliers = ref<any[]>([]);
    const pagination = ref({
        pageNum: 1,
        pageSize: 10,
        total: 0,
    });

    // Filter parameters
    const dateRange = ref<[Dayjs, Dayjs] | []>([]);
    const selectedSupplierId = ref<number | undefined>(undefined);
    const selectedProductModelSN = ref<string | undefined>(undefined);

    const columns = [
        {
            title: '供应商',
            dataIndex: 'supplierName',
            key: 'supplierName',
        },
        {
            title: '产品型号',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: '物料编码',
            dataIndex: 'productModelSN',
            key: 'productModelSN',
        },
        {
            title: '检测日期',
            dataIndex: 'qualityDate',
            key: 'qualityDate',
            customRender: ({ text }: { text: string }) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '',
        },
        {
            title: '电机SN',
            dataIndex: 'productSN',
            key: 'productSN',
        },
        {
            title: '批次号',
            dataIndex: 'batchNumber',
            key: 'batchNumber',
        },
        {
            title: '缺陷原因',
            dataIndex: 'defectReason',
            key: 'defectReason',
        },
    ];

    const list = async () => {
        isLoading.value = true;
        const query = buildQuery();

        try {
            const response = await getDefectReport(query);
            let defectData = response.data.data || [];

            // Client-side filtering to ensure only matching description products are shown
            if (selectedProductModelSN.value) {
                defectData = defectData.filter((item: DefectReportItem) =>
                    item.description === selectedProductModelSN.value
                );
            }

            data.value = defectData;
            pagination.value.total = defectData.length;
        } catch (error: any) {
            message.error(`获取缺陷报表失败: ${error.response?.data?.error || error.message}`);
            return Promise.reject(error);
        } finally {
            isLoading.value = false;
        }
    };

    const loadSuppliers = async () => {
        try {
            const response = await getSuppliers({ pageSize: 100 });
            suppliers.value = response.data.data;
        } catch (error: any) {
            message.error(`加载供应商失败: ${error.response?.data?.error || error.message}`);
        }
    };

    const resetFilters = () => {
        dateRange.value = [];
        selectedSupplierId.value = undefined;
        selectedProductModelSN.value = undefined;
        pagination.value.pageNum = 1;
    };

    // 构建查询参数
    const buildQuery = (pageNum?: number, pageSize?: number): DefectReportQueryParams => {
        const query: DefectReportQueryParams = {
            pageNum: pageNum ?? pagination.value.pageNum,
            pageSize: pageSize ?? pagination.value.pageSize,
        };

        // Add filters if they have values
        if (selectedSupplierId.value) query.supplierId = selectedSupplierId.value;
        if (selectedProductModelSN.value) query.description = selectedProductModelSN.value;

        // Handle date range
        if (dateRange.value && dateRange.value.length === 2) {
            query.startDate = dateRange.value[0].format('YYYY-MM-DD');
            query.endDate = dateRange.value[1].format('YYYY-MM-DD');
        }

        return query;

    };

    // Excel导出功能
    const exportToExcel = async () => {
        const query = buildQuery(undefined, -1);
        const response = await getDefectReport(query);
        let allData = response.data.data;


        if (!allData || allData.length === 0) {
            message.warning('没有数据可以导出');
            return;
        }

        try {
            // 创建工作簿
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('缺陷产品报表');

            // 先设置列宽
            worksheet.columns = [
                { width: 20 },  // 供应商
                { width: 20 },  // 检测日期
                { width: 25 },  // 产品SN
                { width: 20 },  // 产品型号SAP
                { width: 15 },  // 批次号
                { width: 20 }   // 缺陷原因
            ];

            // 添加汇总信息行
            const totalCount = allData.length;
            const currentDate = dayjs().format('YYYY-MM-DD HH:mm:ss');

            // 第1行：总计
            worksheet.addRow(['总计:', `${totalCount} 件`, '', '', '', '']);
            // 第2行：导出日期
            worksheet.addRow(['导出日期:', currentDate, '', '', '', '']);
            // 第3行：空行
            worksheet.addRow(['', '', '', '', '', '']);
            // 第4行：表头
            worksheet.addRow(['供应商', '检测日期', '产品SN', '产品型号SAP', '批次号', '缺陷原因']);

            // 添加数据
            allData.forEach((item: DefectReportItem) => {
                worksheet.addRow([
                    item.supplierName || '',
                    item.qualityDate ? dayjs(item.qualityDate).format('YYYY-MM-DD HH:mm:ss') : '',
                    item.productSN || '',
                    item.productModelSN || '',
                    item.batchNumber || '',
                    item.defectReason || ''
                ]);
            });

            // 设置汇总信息行样式（前2行）
            for (let i = 1; i <= 2; i++) {
                const row = worksheet.getRow(i);
                row.height = 22;
                row.eachCell((cell, colNumber) => {
                    if (colNumber <= 2) {
                        cell.font = { bold: true, size: 12, color: { argb: '00000000' } };
                        if (colNumber === 1) {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFCCCCCC' }
                            };
                        } else {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFFFFFF' }
                            };
                        }
                        cell.border = {
                            top: { style: 'thin', color: { argb: '00000000' } },
                            left: { style: 'thin', color: { argb: '00000000' } },
                            bottom: { style: 'thin', color: { argb: '00000000' } },
                            right: { style: 'thin', color: { argb: '00000000' } }
                        };
                        cell.alignment = { vertical: 'middle', horizontal: 'left' };
                    }
                });
                // 合并第2-6列用于显示完整内容
                worksheet.mergeCells(`B${i}:F${i}`);
            }

            // 设置表头行样式（第4行）
            const headerRow = worksheet.getRow(4);
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

            // 设置数据行样式（从第5行开始）
            for (let i = 5; i <= worksheet.rowCount; i++) {
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
            const fileName = `缺陷产品报表_${dayjs().format('YYYY-MM-DD')}.xlsx`;

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
        suppliers,
        columns,
        pagination,
        dateRange,
        selectedSupplierId,
        selectedProductModelSN,
        list,
        loadSuppliers,
        resetFilters,
        exportToExcel
    };
};

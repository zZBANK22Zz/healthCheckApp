const BMIpersonalPopUp = ({ isOpen, bmi, category, advice, onClose }) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 text-white">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">ผลการคำนวณ BMI</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full bg-white/20 p-1 transition hover:bg-white/30"
                            aria-label="ปิด"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="space-y-4 px-6 py-6">
                    <div className="text-center">
                        <p className="text-sm font-medium text-gray-500">ดัชนีมวลกายของคุณ</p>
                        <p className="text-5xl font-bold text-blue-600">{bmi}</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 px-4 py-3 text-center">
                        <p className="text-sm font-semibold text-blue-700">อยู่ในเกณฑ์</p>
                        <p className="text-lg font-bold text-blue-900">{category}</p>
                    </div>
                    {advice && (
                        <div className="rounded-xl bg-gray-50 px-4 py-3 text-gray-600">
                            {advice}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3 font-semibold text-white shadow-md transition hover:shadow-lg"
                    >
                        ปิดหน้าต่าง
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BMIpersonalPopUp;

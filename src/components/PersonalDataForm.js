import { useState } from 'react';

export default function PersonalDataForm() {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        sex: '',
        age: '',
        height: '',
        weight: '',
        dateOfBirth: ''
    });

    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.firstName.trim()) {
            newErrors.firstName = 'กรุณากรอกชื่อ';
        }

        if (!formData.lastName.trim()) {
            newErrors.lastName = 'กรุณากรอกนามสกุล';
        }

        if (!formData.sex) {
            newErrors.sex = 'กรุณาเลือกเพศ';
        }

        if (!formData.age || formData.age < 1 || formData.age > 120) {
            newErrors.age = 'กรุณากรอกอายุที่ถูกต้อง (1-120 ปี)';
        }

        if (!formData.height || formData.height < 50 || formData.height > 300) {
            newErrors.height = 'กรุณากรอกส่วนสูงที่ถูกต้อง (50-300 ซม.)';
        }

        if (!formData.weight || formData.weight < 20 || formData.weight > 500) {
            newErrors.weight = 'กรุณากรอกน้ำหนักที่ถูกต้อง (20-500 กก.)';
        }

        if (!formData.dateOfBirth) {
            newErrors.dateOfBirth = 'กรุณาเลือกวันเกิด';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (validateForm()) {
            // Calculate BMI
            const heightInMeters = formData.height / 100;
            const bmi = (formData.weight / (heightInMeters * heightInMeters)).toFixed(1);
            
            console.log('Form submitted:', { ...formData, bmi });
            alert(`ข้อมูลส่วนตัวถูกบันทึกแล้ว\nดัชนีมวลกาย (BMI): ${bmi}`);
            
            // Here you would typically send data to your backend
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl shadow-xl border border-gray-100">
            <div className="text-center mb-8">
                <div className="inline-block p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                    แบบฟอร์มข้อมูลส่วนตัว
                </h2>
                <p className="text-gray-600">กรุณากรอกข้อมูลเพื่อรับคำแนะนำที่เหมาะสมกับคุณ</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Name Section */}
                <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl border border-white/50 shadow-sm">
                    <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center mr-3">
                            <span className="text-white font-bold text-sm">1</span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800">ข้อมูลทั่วไป</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                                <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                                ชื่อ <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="firstName"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                                    errors.firstName 
                                        ? 'border-red-400 focus:ring-4 focus:ring-red-100 bg-red-50' 
                                        : 'border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100 bg-white hover:border-green-300'
                                }`}
                                placeholder="กรอกชื่อของคุณ"
                            />
                            {errors.firstName && <p className="text-red-500 text-xs mt-2 flex items-center"><span className="mr-1">⚠️</span>{errors.firstName}</p>}
                        </div>

                        <div>
                            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                                <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                                นามสกุล <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="lastName"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                                    errors.lastName 
                                        ? 'border-red-400 focus:ring-4 focus:ring-red-100 bg-red-50' 
                                        : 'border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 bg-white hover:border-blue-300'
                                }`}
                                placeholder="กรอกนามสกุลของคุณ"
                            />
                            {errors.lastName && <p className="text-red-500 text-xs mt-2 flex items-center"><span className="mr-1">⚠️</span>{errors.lastName}</p>}
                        </div>
                    </div>
                </div>

                {/* Sex Selection */}
                <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl border border-white/50 shadow-sm">
                    <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-gradient-to-r from-pink-400 to-purple-500 rounded-full flex items-center justify-center mr-3">
                            <span className="text-white font-bold text-sm">2</span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800">เพศ</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <label className={`relative cursor-pointer transition-all duration-200 ${
                            formData.sex === 'male' 
                                ? 'transform scale-105' 
                                : 'hover:scale-102'
                        }`}>
                            <input
                                type="radio"
                                name="sex"
                                value="male"
                                checked={formData.sex === 'male'}
                                onChange={handleChange}
                                className="sr-only"
                            />
                            <div className={`p-4 rounded-xl border-2 text-center transition-all duration-200 ${
                                formData.sex === 'male'
                                    ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-blue-100 shadow-md'
                                    : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                            }`}>
                                <div className={`text-2xl mb-2 ${
                                    formData.sex === 'male' ? 'animate-bounce' : ''
                                }`}>👨</div>
                                <span className={`font-medium ${
                                    formData.sex === 'male' ? 'text-blue-700' : 'text-gray-700'
                                }`}>ชาย</span>
                            </div>
                        </label>
                        
                        <label className={`relative cursor-pointer transition-all duration-200 ${
                            formData.sex === 'female' 
                                ? 'transform scale-105' 
                                : 'hover:scale-102'
                        }`}>
                            <input
                                type="radio"
                                name="sex"
                                value="female"
                                checked={formData.sex === 'female'}
                                onChange={handleChange}
                                className="sr-only"
                            />
                            <div className={`p-4 rounded-xl border-2 text-center transition-all duration-200 ${
                                formData.sex === 'female'
                                    ? 'border-pink-400 bg-gradient-to-br from-pink-50 to-pink-100 shadow-md'
                                    : 'border-gray-200 bg-white hover:border-pink-300 hover:shadow-sm'
                            }`}>
                                <div className={`text-2xl mb-2 ${
                                    formData.sex === 'female' ? 'animate-bounce' : ''
                                }`}>👩</div>
                                <span className={`font-medium ${
                                    formData.sex === 'female' ? 'text-pink-700' : 'text-gray-700'
                                }`}>หญิง</span>
                            </div>
                        </label>
                    </div>
                    {errors.sex && <p className="text-red-500 text-xs mt-2 flex items-center"><span className="mr-1">⚠️</span>{errors.sex}</p>}
                </div>

                {/* Age and Date of Birth */}
                <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl border border-white/50 shadow-sm">
                    <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mr-3">
                            <span className="text-white font-bold text-sm">3</span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800">อายุและวันเกิด</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                                <span className="text-xl mr-2">🎂</span>
                                อายุ (ปี) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                id="age"
                                name="age"
                                value={formData.age}
                                onChange={handleChange}
                                min="1"
                                max="120"
                                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                                    errors.age 
                                        ? 'border-red-400 focus:ring-4 focus:ring-red-100 bg-red-50' 
                                        : 'border-gray-200 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 bg-white hover:border-yellow-300'
                                }`}
                                placeholder="เช่น 25"
                            />
                            {errors.age && <p className="text-red-500 text-xs mt-2 flex items-center"><span className="mr-1">⚠️</span>{errors.age}</p>}
                        </div>

                        <div>
                            <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                                <span className="text-xl mr-2">📅</span>
                                วันเกิด <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                id="dateOfBirth"
                                name="dateOfBirth"
                                value={formData.dateOfBirth}
                                onChange={handleChange}
                                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                                    errors.dateOfBirth 
                                        ? 'border-red-400 focus:ring-4 focus:ring-red-100 bg-red-50' 
                                        : 'border-gray-200 focus:border-orange-400 focus:ring-4 focus:ring-orange-100 bg-white hover:border-orange-300'
                                }`}
                            />
                            {errors.dateOfBirth && <p className="text-red-500 text-xs mt-2 flex items-center"><span className="mr-1">⚠️</span>{errors.dateOfBirth}</p>}
                        </div>
                    </div>
                </div>

                {/* Height and Weight */}
                <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl border border-white/50 shadow-sm">
                    <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mr-3">
                            <span className="text-white font-bold text-sm">4</span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800">ข้อมูลร่างกาย</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="height" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                                <span className="text-xl mr-2">📏</span>
                                ส่วนสูง (ซม.) <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    id="height"
                                    name="height"
                                    value={formData.height}
                                    onChange={handleChange}
                                    min="50"
                                    max="300"
                                    step="0.1"
                                    className={`w-full px-4 py-3 pr-12 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                                        errors.height 
                                            ? 'border-red-400 focus:ring-4 focus:ring-red-100 bg-red-50' 
                                            : 'border-gray-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 bg-white hover:border-emerald-300'
                                    }`}
                                    placeholder="170"
                                />
                                <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">ซม.</span>
                            </div>
                            {errors.height && <p className="text-red-500 text-xs mt-2 flex items-center"><span className="mr-1">⚠️</span>{errors.height}</p>}
                        </div>

                        <div>
                            <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                                <span className="text-xl mr-2">⚖️</span>
                                น้ำหนัก (กก.) <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    id="weight"
                                    name="weight"
                                    value={formData.weight}
                                    onChange={handleChange}
                                    min="20"
                                    max="500"
                                    step="0.1"
                                    className={`w-full px-4 py-3 pr-12 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                                        errors.weight 
                                            ? 'border-red-400 focus:ring-4 focus:ring-red-100 bg-red-50' 
                                            : 'border-gray-200 focus:border-teal-400 focus:ring-4 focus:ring-teal-100 bg-white hover:border-teal-300'
                                    }`}
                                    placeholder="65.5"
                                />
                                <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">กก.</span>
                            </div>
                            {errors.weight && <p className="text-red-500 text-xs mt-2 flex items-center"><span className="mr-1">⚠️</span>{errors.weight}</p>}
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                <div className="text-center pt-6">
                    <button
                        type="submit"
                        className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white font-bold py-4 px-12 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-purple-300 focus:ring-offset-2 group"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative flex items-center justify-center space-x-2">
                            <span className="text-lg">📊</span>
                            <span>บันทึกข้อมูลและคำนวณ BMI</span>
                            <span className="text-lg">✨</span>
                        </div>
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </button>
                    <p className="text-sm text-gray-500 mt-3">🔒 ข้อมูลของคุณจะถูกเก็บอย่างปลอดภัย</p>
                </div>
            </form>
        </div>
    );
}
import PersonalDataForm from "../components/PersonalDataForm";

export default function Home(){
    return(
        <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-cyan-100 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
            <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
            
            <div className="relative flex flex-col justify-center items-center p-6 md:p-10">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-400 to-blue-500 rounded-full mb-4 shadow-lg">
                        <span className="text-2xl">🌱</span>
                    </div>
                    <h1 className="text-center text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                        โปรแกรมแนะนำอาหารและตารางการออกกำลังกาย
                    </h1>
                    <p className="text-gray-600 text-lg mb-6">
                        🍿 เริ่มต้นการดูแลสุขภาพที่ดีขึ้นด้วยการกรอกข้อมูลของคุณ 💪
                    </p>
                </div>
                <PersonalDataForm />
            </div>
        </div>
    );
}

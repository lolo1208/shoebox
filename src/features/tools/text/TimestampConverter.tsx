
/// <reference lib="dom" />
import React, { useState, useEffect } from 'react';
import { Play, Pause, Copy, Check, Calendar, ArrowRight, Settings2, RotateCcw, ArrowDown, Moon, Sun, ArrowLeftRight, ArrowDownUp, Sparkles, Clock, Hourglass } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useLanguage } from '@/contexts/LanguageContext';
import { useClipboard } from '@/hooks/useClipboard';
import { Lunar, Solar } from 'lunar-javascript';

// 类型与工具函数

type TimeUnit = 's' | 'ms';
type InputMode = 'date' | 'timestamp';

// 工具函数：格式化冬月、腊月、正月
const getTraditionalMonthName = (month: number): string => {
    if (month === 1) return '正月';
    if (month === 11) return '冬月';
    if (month === 12) return '腊月';
    
    const map = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    return map[month] + '月';
};

const getSupportedTimezones = (): string[] => {
    try {
        // @ts-ignore
        if (typeof Intl.supportedValuesOf === 'function') {
            // @ts-ignore
            return Intl.supportedValuesOf('timeZone');
        }
    } catch (e) {
        console.warn(e);
    }
    return ['UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'America/New_York', 'Europe/London'];
};

const getTimezoneOffset = (timeZone: string) => {
    try {
        const now = new Date();
        const iso = now.toLocaleString('en-US', { timeZone, timeZoneName: 'shortOffset' });
        // 匹配 GMT+8、GMT-5、GMT+5:30
        const match = iso.match(/GMT([+-]\d+(?::\d+)?)/);
        return match ? match[1] : '+0';
    } catch (e) {
        return '';
    }
};

// 拆分的子组件

const CopyBtn = ({ text, className = "" }: { text: string, className?: string }) => {
    const { t } = useLanguage();
    const { copy, isCopied } = useClipboard(2000);
    return (
        <button 
            onClick={(e) => { e.stopPropagation(); void copy(text); }}
            className={`p-1.5 rounded transition-all duration-200 ${isCopied() ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'} ${className}`}
            title={t('common.copy')}
        >
            {isCopied() ? <Check size={14} /> : <Copy size={14} />}
        </button>
    );
};

// 分段切换输入组件
const TimeInput = ({ 
    mode, 
    val, 
    onChange, 
    onModeChange,
    t
}: { 
    mode: InputMode, 
    val: string, 
    onChange: (v: string) => void, 
    onModeChange: (m: InputMode) => void,
    t: any
}) => (
    <div className="flex flex-col gap-3 w-full">
        {/* Segmented Control */}
        <div className="bg-gray-100/80 p-1 rounded-lg flex w-fit select-none border border-gray-200">
            <button
                onClick={() => onModeChange('date')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all duration-200 flex items-center gap-1.5 ${
                    mode === 'date' 
                    ? 'bg-white text-primary-600 shadow-sm ring-1 ring-black/5' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                <Calendar size={14} />
                {t('tool.timestamp.name')}
            </button>
            <button
                onClick={() => onModeChange('timestamp')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all duration-200 flex items-center gap-1.5 ${
                    mode === 'timestamp' 
                    ? 'bg-white text-primary-600 shadow-sm ring-1 ring-black/5' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                <Clock size={14} />
                {t('time.current_ts').replace('Current ', '')}
            </button>
        </div>

        {/* Input Field */}
        <div className="relative group">
            {mode === 'date' ? (
                <input 
                    type="datetime-local" 
                    step="1"
                    value={val}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all outline-none shadow-sm group-hover:border-gray-300"
                />
            ) : (
                <input 
                    type="number" 
                    placeholder="Timestamp (e.g. 1679000000)"
                    value={val}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all outline-none shadow-sm group-hover:border-gray-300"
                />
            )}
        </div>
    </div>
);

const TimestampConverter: React.FC = () => {
    const { t, language } = useLanguage();
    // 全局设置
    const [unit, setUnit] = useLocalStorage<TimeUnit>('tool-ts-unit', 'ms');
    const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const [displayZone, setDisplayZone] = useLocalStorage<string>('tool-ts-zone', localZone);
    
    // 实时时钟
    const [now, setNow] = useState<number>(Date.now());
    const [isPaused, setIsPaused] = useState(false);

    // 转换器：时间戳 → 日期
    const [inputTs, setInputTs] = useState<string>('');
    const [tsToDateResult, setTsToDateResult] = useState<string>('');

    // 转换器：日期 → 时间戳
    const [inputDate, setInputDate] = useState<string>('');
    const [dateToTsResult, setDateToTsResult] = useState<string>('');

    // 时长计算
    const [startMode, setStartMode] = useState<InputMode>('date');
    const [endMode, setEndMode] = useState<InputMode>('date');
    const [startVal, setStartVal] = useState<string>('');
    const [endVal, setEndVal] = useState<string>('');
    const [diffResult, setDiffResult] = useState<string>('');

    // 农历状态
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    
    // 派生状态
    const [solarStr, setSolarStr] = useState('');
    const [solarWeekday, setSolarWeekday] = useState('');
    const [solarZodiac, setSolarZodiac] = useState('');
    const [lunarYear, setLunarYear] = useState(0);
    const [lunarMonth, setLunarMonth] = useState(1);
    const [lunarDay, setLunarDay] = useState(1);
    const [isLeap, setIsLeap] = useState(false);
    
    // 格式化输出
    const [lunarText, setLunarText] = useState('');
    const [lunarGanZhiFull, setLunarGanZhiFull] = useState('');
    const [zodiac, setZodiac] = useState('');

    // 缓存数据
    const supportedZones = React.useMemo(() => getSupportedTimezones(), []);

    // 带翻译的工具函数
    const getWeekName = (date: Date): string => {
        return t(`time.week_${date.getDay()}`);
    };

    const getZodiacKey = (date: Date): string => {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const signs = ['capricorn', 'aquarius', 'pisces', 'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius'];
        const startDays = [20, 19, 21, 20, 21, 21, 22, 23, 23, 23, 22, 22];
        
        if (day < startDays[month - 1]) {
            return signs[month - 1 === 0 ? 11 : month - 2];
        }
        return signs[month - 1];
    };

    // 实时刷新
    useEffect(() => {
        if (isPaused) return;
        const timer = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(timer);
    }, [isPaused]);

    const togglePause = () => {
        const nextState = !isPaused;
        setIsPaused(nextState);
        if (!nextState) {
            setNow(Date.now()); // Immediate update on resume
        }
    };

    // 格式化工具
    const formatDateTime = (ts: number, zone: string) => {
        try {
            // 使用当前语言作为区域设置
            const locale = language === 'zh' ? 'zh-CN' : 'en-US';
            return new Intl.DateTimeFormat(locale, {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false,
                timeZone: zone,
            }).format(ts);
        } catch (e) {
            return 'Invalid Date';
        }
    };
    
    const getWeekday = (ts: number, zone: string) => {
        try {
            // 通过键查表格式化星期，保证与翻译一致
            const d = new Date(ts);
            // 星期需要按所选时区计算。
            // Intl 会直接返回本地化字符串，
            // 为了使用翻译键，需要先取出该时区下的星期序号。
            const locale = language === 'zh' ? 'zh-CN' : 'en-US';
            return new Intl.DateTimeFormat(locale, {
                weekday: 'long',
                timeZone: zone,
            }).format(ts);
        } catch (e) {
            return '';
        }
    };

    // 转换逻辑
    
    // 1. 时间戳 → 日期
    useEffect(() => {
        if (!inputTs.trim()) {
            setTsToDateResult('');
            return;
        }
        let ts = parseFloat(inputTs);
        if (isNaN(ts)) {
            setTsToDateResult(t('time.invalid_ts'));
            return;
        }
        if (unit === 's') ts *= 1000;
        setTsToDateResult(formatDateTime(ts, displayZone));
    }, [inputTs, unit, displayZone, language]);

    // 2. 日期 → 时间戳
    useEffect(() => {
        if (!inputDate) {
            setDateToTsResult('');
            return;
        }
        try {
            const d = new Date(inputDate);
            if (isNaN(d.getTime())) {
                setDateToTsResult(t('time.invalid_date'));
                return;
            }
            let ts = d.getTime();
            if (unit === 's') {
                setDateToTsResult(Math.floor(ts / 1000).toString());
            } else {
                setDateToTsResult(ts.toString());
            }
        } catch (e) {
            setDateToTsResult('Error');
        }
    }, [inputDate, unit, language]);

    // 时长逻辑
    useEffect(() => {
        const getTs = (mode: InputMode, val: string): number | null => {
            if (!val) return null;
            if (mode === 'timestamp') {
                const t = parseFloat(val);
                return isNaN(t) ? null : (unit === 's' ? t * 1000 : t);
            } else {
                const d = new Date(val);
                return isNaN(d.getTime()) ? null : d.getTime();
            }
        };

        const t1 = getTs(startMode, startVal);
        const t2 = getTs(endMode, endVal);

        if (t1 === null || t2 === null) {
            setDiffResult('');
            return;
        }

        let diff = Math.abs(t2 - t1);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        diff -= days * (1000 * 60 * 60 * 24);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        diff -= hours * (1000 * 60 * 60);
        const minutes = Math.floor(diff / (1000 * 60));
        diff -= minutes * (1000 * 60);
        const seconds = Math.floor(diff / 1000);
        const ms = diff % 1000;

        setDiffResult(`${days}${t('time.day_s')} ${hours}${t('time.hour_s')} ${minutes}${t('time.minute_s')} ${seconds}${t('time.second_s')} ${unit === 'ms' ? ms + t('time.millisecond_s') : ''}`);

    }, [startMode, endMode, startVal, endVal, unit, language]);

    // 农历逻辑
    
    // 初始化
    useEffect(() => {
        const d = new Date();
        // 重置到中午，避免纯日期的时区边界问题
        d.setHours(12, 0, 0, 0); 
        updateFromSolar(d);
    }, [language]); // Refresh when language changes to update translation text

    const updateFromSolar = (d: Date) => {
        if (isNaN(d.getTime())) return;
        
        // 更新公历界面
        setSolarStr(d.toISOString().slice(0, 10)); // YYYY-MM-DD
        setSolarWeekday(getWeekName(d));
        setSolarZodiac(t(`time.zodiac_${getZodiacKey(d)}`));

        // 计算农历
        const solar = Solar.fromDate(d);
        const lunar = solar.getLunar();

        // 更新农历控件
        setLunarYear(lunar.getYear());
        setLunarMonth(Math.abs(lunar.getMonth())); // Lunar library uses negative for leap
        setLunarDay(lunar.getDay());
        setIsLeap(lunar.getMonth() < 0);

        // 更新文本
        generateResultText(lunar);
    };

    const updateFromLunar = (y: number, m: number, d: number, leap: boolean) => {
        if (isNaN(y)) return;
        try {
            // 农历库用负数表示闰月
            const effectiveMonth = leap ? -Math.abs(m) : Math.abs(m);
            const lunar = Lunar.fromYmd(y, effectiveMonth, d);
            const solar = lunar.getSolar();
            
            // 转为 JS Date
            const jsDate = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay(), 12, 0, 0);
            
            // 更新公历界面
            setSolarStr(jsDate.toISOString().slice(0, 10));
            setSolarWeekday(getWeekName(jsDate));
            setSolarZodiac(t(`time.zodiac_${getZodiacKey(jsDate)}`));
            
            // 更新文本
            generateResultText(lunar);
        } catch (e) {
            console.error("Invalid lunar date", e);
        }
    };

    const generateResultText = (lunar: Lunar) => {
        // Format: 甲辰(龙)年 四月 十五
        // 说明：受农历库限制，输出以中文为主。
        // We keep the main text in Chinese characters as it's specific to Chinese Calendar.
        const yearGanZhi = lunar.getYearInGanZhi();
        const zodiac = lunar.getYearShengXiao();
        const monthStr = (lunar.getMonth() < 0 ? '闰' : '') + getTraditionalMonthName(Math.abs(lunar.getMonth()));
        const dayStr = lunar.getDayInChinese();
        
        setLunarText(`${yearGanZhi}年 ${monthStr} ${dayStr}`);
        setLunarGanZhiFull(`${lunar.getMonthInGanZhi()}月 ${lunar.getDayInGanZhi()}日`);
        setZodiac(zodiac);
    };

    // 事件处理
    const handleSolarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSolarStr(val);
        // 先检查日期字符串长度（YYYY-MM-DD 为 10 位）
        if (val.length === 10) {
            const d = new Date(val);
            d.setHours(12, 0, 0, 0);
            if (!isNaN(d.getTime())) {
                updateFromSolar(d);
            }
        }
    };

    const handleLunarChange = (field: 'y'|'m'|'d'|'leap', val: number | boolean) => {
        // 年份输入被清空
        if (field === 'y' && typeof val === 'number' && isNaN(val)) {
            setLunarYear(NaN);
            return;
        }

        // 年份为 NaN 时的回退值
        const safeYear = isNaN(lunarYear) ? new Date().getFullYear() : lunarYear;

        let y = field === 'y' ? val as number : safeYear;
        let m = field === 'm' ? val as number : lunarMonth;
        let d = field === 'd' ? val as number : lunarDay;
        let leap = field === 'leap' ? val as boolean : isLeap;

        // 校验工具
        const check = (ty: number, tm: number, td: number, tleap: boolean) => {
            if (isNaN(ty)) return false;
            try {
                Lunar.fromYmd(ty, tleap ? -Math.abs(tm) : Math.abs(tm), td);
                return true;
            } catch (e) {
                return false;
            }
        };

        // 1. Check strict (user input)
        if (!check(y, m, d, leap)) {
            // 2. Try fixing day (if day is 30, try 29) - Lunar months are 29 or 30 days
            if (d === 30 && check(y, m, 29, leap)) {
                d = 29;
            } 
            // 3. Try fixing leap (if leap is active but not valid for this month/year)
            else if (leap && check(y, m, d, false)) {
                 leap = false;
            }
            // 4. Try fixing both (day 29 + no leap)
            else if (d === 30 && leap && check(y, m, 29, false)) {
                d = 29;
                leap = false;
            }
            // 5. Fallback: reset to day 1 if all else fails (e.g. changing month/year drastic mismatch)
            else if (check(y, m, 1, leap)) {
                d = 1;
            }
             // 6. Absolute Fallback
            else if (check(y, m, 1, false)) {
                d = 1;
                leap = false;
            }
        }

        setLunarYear(y);
        setLunarMonth(m);
        setLunarDay(d);
        setIsLeap(leap);

        updateFromLunar(y, m, d, leap);
    };

    const zoneOffset = getTimezoneOffset(displayZone);

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-10">
            
            {/* 1. Global Settings & Dashboard Combined Hero */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                {/* Hero Header */}
                <div className="bg-gradient-to-br from-white to-gray-50 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-8 border-b border-gray-100">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={togglePause}
                            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 shadow-sm ${isPaused ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-primary-50 text-primary-600 hover:bg-primary-100 hover:shadow-md'}`}
                        >
                            {isPaused ? <Play size={24} fill="currentColor" /> : <Pause size={24} fill="currentColor" />}
                        </button>
                        
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border transition-colors ${isPaused ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-primary-50 text-primary-600 border-primary-100'}`}>
                                    {isPaused ? t('time.paused') : t('time.current')}
                                </span>
                                <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{displayZone} ({zoneOffset})</span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4">
                                <div className="text-4xl sm:text-5xl font-mono font-bold text-gray-900 tracking-tight tabular-nums leading-none">
                                    {formatDateTime(now, displayZone).split(' ')[1]}
                                </div>
                                <div className="flex items-center gap-2 text-gray-500">
                                    <span className="text-sm font-medium">{formatDateTime(now, displayZone).split(' ')[0]}</span>
                                    <span className="text-sm font-medium border-l border-gray-300 pl-2">
                                        {getWeekday(now, displayZone)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">{t('time.current_ts')} ({unit})</div>
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-2 pl-4 shadow-sm hover:border-primary-300 transition-colors">
                            <span className="font-mono text-xl font-bold text-primary-600">
                                 {unit === 's' ? Math.floor(now / 1000) : now}
                            </span>
                            <div className="h-6 w-px bg-gray-100 mx-1"></div>
                            <CopyBtn text={(unit === 's' ? Math.floor(now / 1000) : now).toString()} />
                        </div>
                    </div>
                </div>

                {/* Settings Strip */}
                <div className="px-6 py-4 bg-gray-50/50 flex flex-wrap gap-x-8 gap-y-4 items-center border-t border-gray-100">
                    <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                        <Settings2 size={16} />
                        <span>{t('time.pref')}</span>
                    </div>
                    
                    <div className="h-4 w-px bg-gray-300 hidden sm:block"></div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 font-bold uppercase">{t('time.unit')}</span>
                        <div className="flex bg-white rounded-lg border border-gray-200 p-0.5">
                            <button onClick={() => setUnit('s')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${unit === 's' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t('time.second_s')}</button>
                            <button onClick={() => setUnit('ms')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${unit === 'ms' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t('time.millisecond_s')}</button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 font-bold uppercase">{t('time.zone')}</span>
                        <select 
                            value={displayZone}
                            onChange={(e) => setDisplayZone(e.target.value)}
                            className="bg-white border border-gray-200 text-gray-700 text-xs rounded-lg p-1.5 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        >
                            <option value={localZone}>{t('time.local')} ({localZone}) ({getTimezoneOffset(localZone)})</option>
                            <option value="UTC">UTC (+0)</option>
                            {supportedZones.filter(z => z !== 'UTC' && z !== localZone).map(z => <option key={z} value={z}>{z} ({getTimezoneOffset(z)})</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* 3. Conversion Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* TS -> Date */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <div className="font-bold text-gray-800 flex items-center gap-3">
                            <span className="text-lg">{t('time.ts_to_date')}</span>
                        </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col gap-5">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs text-gray-500 font-bold uppercase">{t('time.input_ts')}</label>
                                <button 
                                    onClick={() => setInputTs((unit === 's' ? Math.floor(now/1000) : now).toString())}
                                    className="text-xs text-primary-600 hover:text-primary-700 font-medium hover:underline transition-colors"
                                >
                                    {t('time.fill_current')}
                                </button>
                            </div>
                            <input 
                                type="number" 
                                value={inputTs}
                                onChange={(e) => setInputTs(e.target.value)}
                                placeholder="例如: 1679000000"
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all outline-none"
                            />
                        </div>

                        <div className="flex justify-center text-gray-300">
                            <ArrowDown size={20} className="" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-gray-500 font-bold uppercase">{t('time.result')}</label>
                            <div className="w-full p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center justify-between group">
                                <span className={`font-mono font-medium break-all ${tsToDateResult ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                    {tsToDateResult || t('common.waiting')}
                                </span>
                                {tsToDateResult && <CopyBtn text={tsToDateResult} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Date -> TS */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <div className="font-bold text-gray-800 flex items-center gap-3">
                            <span className="text-lg">{t('time.date_to_ts')}</span>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-5">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs text-gray-500 font-bold uppercase">{t('time.select_date')}</label>
                                <button 
                                    onClick={() => {
                                        // 设为当前本地时间（精确到分钟）
                                        const d = new Date();
                                        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                                        setInputDate(d.toISOString().slice(0, 16));
                                    }}
                                    className="text-xs text-primary-600 hover:text-primary-700 font-medium hover:underline transition-colors"
                                >
                                    {t('time.fill_current')}
                                </button>
                            </div>
                            <input 
                                type="datetime-local" 
                                step="1"
                                value={inputDate}
                                onChange={(e) => setInputDate(e.target.value)}
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all outline-none"
                            />
                        </div>

                        <div className="flex justify-center text-gray-300">
                            <ArrowDown size={20} className="" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-gray-500 font-bold uppercase">{t('time.result')}</label>
                            <div className="w-full p-4 bg-purple-50/50 border border-purple-100 rounded-xl flex items-center justify-between group">
                                <span className={`font-mono font-medium break-all ${dateToTsResult ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                    {dateToTsResult || t('common.waiting')}
                                </span>
                                {dateToTsResult && <CopyBtn text={dateToTsResult} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Duration Calculator */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center gap-3 font-bold text-gray-900 mb-8 pb-4 border-b border-gray-100">
                    <span className="text-lg">{t('time.duration')}</span>
                </div>
                
                <div className="flex flex-col lg:flex-row gap-8 lg:items-start">
                    <div className="flex-1 w-full space-y-3">
                        <label className="text-xs text-gray-500 font-bold uppercase pl-1">{t('time.start')}</label>
                        <TimeInput 
                            mode={startMode} 
                            val={startVal} 
                            onChange={setStartVal} 
                            onModeChange={setStartMode} 
                            t={t}
                        />
                    </div>
                    
                    <div className="flex items-center justify-center lg:pt-10 text-gray-300">
                        <ArrowRight size={24} className="hidden lg:block" />
                        <ArrowDown size={24} className="lg:hidden" />
                    </div>

                    <div className="flex-1 w-full space-y-3">
                        <label className="text-xs text-gray-500 font-bold uppercase pl-1">{t('time.end')}</label>
                        <TimeInput 
                            mode={endMode} 
                            val={endVal} 
                            onChange={setEndVal} 
                            onModeChange={setEndMode}
                            t={t}
                        />
                    </div>
                </div>

                <div className="mt-8">
                     <div className="w-full p-6 bg-gray-50 border border-gray-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                         <span className="text-sm font-bold text-gray-600 uppercase tracking-wide flex items-center gap-2">
                             {t('time.diff')}
                         </span>
                         <span className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">
                             {diffResult || <span className="text-gray-300 font-normal italic">{t('common.waiting')}</span>}
                         </span>
                     </div>
                </div>
            </div>

            {/* 5. Unified Lunar Calendar Converter */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center gap-3 font-bold text-gray-900 mb-8 pb-4 border-b border-gray-100">
                    <span className="text-lg">{t('time.lunar_conv')}</span>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 lg:items-stretch">
                    
                    {/* Left: Solar Panel */}
                    <div className="flex-1 p-6 bg-orange-50/30 rounded-2xl border border-orange-100 flex flex-col gap-6">
                        <div className="flex items-center gap-2 text-orange-700 font-bold">
                            <Sun size={20} />
                            <span>{t('time.solar')}</span>
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center space-y-4">
                            <div className="flex justify-between items-baseline">
                                <label className="text-xs text-gray-500 font-bold uppercase">{t('time.select_date')}</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white bg-orange-400 px-2 py-0.5 rounded-full shadow-sm">{solarWeekday}</span>
                                    {solarZodiac && (
                                        <span className="text-xs font-bold text-orange-600 bg-white border border-orange-200 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                            <Sparkles size={10} />
                                            {solarZodiac}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <input 
                                type="date"
                                value={solarStr}
                                onChange={handleSolarChange}
                                className="w-full p-4 bg-white border border-orange-200/60 rounded-xl font-sans text-xl text-gray-800 font-medium focus:ring-2 focus:ring-orange-200 focus:border-orange-400 transition-all outline-none shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Middle: Exchange Icon */}
                    <div className="flex items-center justify-center text-gray-300">
                        <div className="p-2 rounded-full bg-gray-50 border border-gray-100">
                            <ArrowLeftRight size={20} className="hidden lg:block text-gray-400" />
                            <ArrowDownUp size={20} className="lg:hidden text-gray-400" />
                        </div>
                    </div>

                    {/* Right: Lunar Panel */}
                    <div className="flex-1 p-6 bg-blue-50/30 rounded-2xl border border-blue-100 flex flex-col gap-6">
                        <div className="flex items-center gap-2 text-blue-700 font-bold">
                            <Moon size={20} />
                            <span>{t('time.lunar')}</span>
                        </div>

                        <div className="flex-1 flex flex-col gap-6">
                            <div className="flex flex-wrap gap-3">
                                <div className="flex-1 min-w-[90px]">
                                    <label className="text-xs text-gray-500 font-bold uppercase mb-1.5 block">{t('time.year')}</label>
                                    <div className="relative">
                                        <input 
                                            type="number"
                                            value={isNaN(lunarYear) ? '' : lunarYear}
                                            onChange={(e) => handleLunarChange('y', parseInt(e.target.value))}
                                            className="w-full p-2.5 pl-3 border border-blue-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none text-gray-800"
                                        />
                                        <span className="absolute right-3 top-2.5 text-gray-400 text-sm">{t('time.year')}</span>
                                    </div>
                                </div>
                                <div className="w-[110px]">
                                    <label className="text-xs text-gray-500 font-bold uppercase mb-1.5 block">{t('time.month')}</label>
                                    <select 
                                        value={lunarMonth} 
                                        onChange={(e) => handleLunarChange('m', parseInt(e.target.value))}
                                        className="w-full p-2.5 border border-blue-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none text-gray-800 cursor-pointer"
                                    >
                                        {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                                            <option key={m} value={m}>{getTraditionalMonthName(m)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-[90px]">
                                    <label className="text-xs text-gray-500 font-bold uppercase mb-1.5 block">{t('time.day')}</label>
                                    <select 
                                        value={lunarDay} 
                                        onChange={(e) => handleLunarChange('d', parseInt(e.target.value))}
                                        className="w-full p-2.5 border border-blue-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none text-gray-800 cursor-pointer"
                                    >
                                        {Array.from({length: 30}, (_, i) => i + 1).map(d => (
                                            <option key={d} value={d}>{d}{t('time.day')}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none group">
                                    <input 
                                        type="checkbox" 
                                        id="leap-check"
                                        checked={isLeap} 
                                        onChange={(e) => handleLunarChange('leap', e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 cursor-pointer"
                                    />
                                    <span className="text-sm text-gray-600 group-hover:text-blue-700 transition-colors">{t('time.leap')}</span>
                                </label>
                            </div>

                            {/* Result Display */}
                            <div className="mt-auto p-5 bg-white rounded-xl border border-blue-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-8 -mt-8 z-0"></div>
                                <div className="relative z-10">
                                    <div className="text-2xl font-bold text-gray-900 font-serif tracking-wide leading-relaxed">
                                        {lunarText}
                                    </div>
                                    <div className="text-sm text-gray-500 mt-2 font-medium flex items-center flex-wrap gap-2">
                                        <span className="bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-md text-xs border border-orange-200/50">{zodiac}{t('time.year')}</span>
                                        {lunarGanZhiFull && (
                                            <>
                                                <span className="text-gray-300">•</span>
                                                <span className="text-gray-500 font-serif">{lunarGanZhiFull}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimestampConverter;

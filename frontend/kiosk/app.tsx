import { useState } from "react"
import { CheckCircle } from "lucide-react"

const PI_SERVER = process.env.NEXT_PUBLIC_PI_SERVER || "http://localhost:5001"

const LANGUAGES = [
    { code: "en", label: "English" },
    { code: "fr", label: "Français" },
    { code: "ar", label: "العربية" },
    { code: "pa", label: "ਪੰਜਾਬੀ" },
    { code: "zh", label: "中文" },
    { code: "es", label: "Español" }
]

const BODY_PARTS = ["chest", "head", "neck", "stomach"]

export default function App() {
    const [lang, setLang] = useState("en")
    const [bodyPart, setBodyPart] = useState("")
    const [questions, setQuestions] = useState<any[]>([])
    const [answers, setAnswers] = useState<Record<string, boolean>>({})
    const [result, setResult] = useState<any>(null)

    const fetchQuestions = async (part: string) => {
        const res = await fetch(`${PI_SERVER}/questions/${part}`)
        const data = await res.json()
        setQuestions(data.questions)
        setAnswers({})
    }

    const handleBodyPartSelect = (part: string) => {
        setBodyPart(part)
        fetchQuestions(part)
    }

    const handleAnswerChange = (id: string, value: boolean) => {
        setAnswers(prev => ({ ...prev, [id]: value }))
        speakQuestion(id, value)
    }

    const speakQuestion = async (id: string, value: boolean) => {
        const question = questions.find(q => q.id === id)?.text
        if (!question) return
        await fetch(`${PI_SERVER}/speak`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: question, lang })
        })
    }

    const submitAnswers = async () => {
        const res = await fetch(`${PI_SERVER}/triage-ai`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body_part: bodyPart, answers })
        })
        const data = await res.json()
        setResult(data)
    }

    return (
        <div style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
            <h1>Kiosk Triage AI</h1>

            {/* Language Selection */}
            <div>
                <label>Select Language: </label>
                <select value={lang} onChange={e => setLang(e.target.value)}>
                    {LANGUAGES.map(l => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                </select>
            </div>

            {/* Body Part */}
            <div style={{ marginTop: 20 }}>
                <label>Which part hurts?</label>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                    {BODY_PARTS.map(bp => (
                        <button
                            key={bp}
                            onClick={() => handleBodyPartSelect(bp)}
                            style={{
                                padding: "8px 16px",
                                background: bodyPart === bp ? "#FAC775" : "#eee",
                                borderRadius: 8,
                                cursor: "pointer"
                            }}
                        >
                            {bp.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Questions */}
            {questions.length > 0 && (
                <div style={{ marginTop: 20 }}>
                    <h3>Questions for {bodyPart}</h3>
                    {questions.map(q => (
                        <div key={q.id} style={{ marginBottom: 8 }}>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={answers[q.id] || false}
                                    onChange={e => handleAnswerChange(q.id, e.target.checked)}
                                />{" "}
                                {q.text}
                            </label>
                        </div>
                    ))}
                </div>
            )}

            {/* Submit */}
            {questions.length > 0 && (
                <button
                    onClick={submitAnswers}
                    style={{ marginTop: 20, padding: "10px 20px", borderRadius: 8 }}
                >
                    Submit
                </button>
            )}

            {/* Result */}
            {result && (
                <div style={{ marginTop: 30, padding: 16, border: "1px solid #ccc", borderRadius: 8 }}>
                    <h2>CTAS Level: {result.ctas_level}</h2>
                    <p>Reason: {result.reason}</p>
                    <p>Action: {result.action}</p>
                </div>
            )}
        </div>
    )
}
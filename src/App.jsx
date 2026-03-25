import { useState, useEffect, useCallback, useRef } from "react";

const EXAMPLE_SENTENCES = [
  {
    label: "🇸🇬 Multilingual SG",
    text: "bro, want makan now? the 菜饭 at com 3 canteen every time long queue one, must go early.",
  },
];

function getInitialTokens(text) {
  return [...text].map((ch) => ch);
}

function findMostFrequentPair(tokens) {
  const pairCounts = {};
  for (let i = 0; i < tokens.length - 1; i++) {
    const pair = tokens[i] + "|" + tokens[i + 1];
    pairCounts[pair] = (pairCounts[pair] || 0) + 1;
  }
  let maxPair = null;
  let maxCount = 0;
  for (const [pair, count] of Object.entries(pairCounts)) {
    if (count > maxCount || (count === maxCount && pair < (maxPair || ""))) {
      maxPair = pair;
      maxCount = count;
    }
  }
  if (maxCount < 2) return null;
  const [left, right] = maxPair.split("|");
  return { left, right, count: maxCount, merged: left + right };
}

function mergePair(tokens, left, right) {
  const result = [];
  let i = 0;
  while (i < tokens.length) {
    if (
      i < tokens.length - 1 &&
      tokens[i] === left &&
      tokens[i + 1] === right
    ) {
      result.push(left + right);
      i += 2;
    } else {
      result.push(tokens[i]);
      i += 1;
    }
  }
  return result;
}

function tokenToDisplay(token) {
  return token.replace(/ /g, "␣").replace(/\n/g, "↵").replace(/\t/g, "→");
}

const PALETTE = [
  "#E07A5F",
  "#3D85C6",
  "#81B29A",
  "#F2CC8F",
  "#6A4C93",
  "#F4845F",
  "#577590",
  "#43AA8B",
  "#F9C74F",
  "#90BE6D",
  "#F94144",
  "#277DA1",
  "#F3722C",
  "#4D908E",
  "#F8961E",
  "#7209B7",
  "#43AA8B",
  "#EF476F",
  "#118AB2",
  "#073B4C",
];

function getTokenColor(token, colorMap) {
  if (!colorMap.current.has(token)) {
    const idx = colorMap.current.size % PALETTE.length;
    colorMap.current.set(token, PALETTE[idx]);
  }
  return colorMap.current.get(token);
}

function TokenChip({ token, color, isNew, isHighlight, small }) {
  const displayed = tokenToDisplay(token);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: small ? "2px 6px" : "4px 10px",
        margin: "2px",
        borderRadius: "6px",
        fontSize: small ? "12px" : "14px",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontWeight: 500,
        background: isHighlight ? `${color}22` : `${color}15`,
        border: `1.5px solid ${isHighlight ? color : color + "55"}`,
        color: "#1a1a2e",
        transition: "all 0.3s ease",
        transform: isNew ? "scale(1.05)" : "scale(1)",
        boxShadow: isNew ? `0 2px 8px ${color}33` : "none",
        whiteSpace: "pre",
        letterSpacing: "0.02em",
      }}
    >
      {displayed}
    </span>
  );
}

function MergeRuleChip({ left, right, merged, color, index }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        borderRadius: "8px",
        background: `${color}08`,
        border: `1px solid ${color}25`,
        fontSize: "13px",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        animation: "fadeSlideIn 0.4s ease forwards",
        opacity: 0,
        animationDelay: `${index * 0.05}s`,
      }}
    >
      <span
        style={{
          color: "#999",
          fontSize: "11px",
          fontWeight: 600,
          minWidth: "20px",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {index + 1}
      </span>
      <span style={{ color: "#555" }}>{tokenToDisplay(left)}</span>
      <span style={{ color: "#bbb", fontSize: "11px" }}>+</span>
      <span style={{ color: "#555" }}>{tokenToDisplay(right)}</span>
      <span style={{ color: "#ccc" }}>→</span>
      <span
        style={{
          padding: "1px 6px",
          borderRadius: "4px",
          background: `${color}20`,
          border: `1px solid ${color}44`,
          color: "#1a1a2e",
          fontWeight: 600,
        }}
      >
        {tokenToDisplay(merged)}
      </span>
    </div>
  );
}

export default function BPEVisualizer() {
  const [inputText, setInputText] = useState(
    "bro, want makan now? the 菜饭 at com 3 canteen every time long queue one, must go early.",
  );
  const [vocabSize, setVocabSize] = useState(100);
  const [vocabSizeInput, setVocabSizeInput] = useState("100");
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const colorMap = useRef(new Map());

  const computeSteps = useCallback((text, maxVocab) => {
    if (!text) return;
    colorMap.current = new Map();
    let tokens = getInitialTokens(text);
    const cumulativeVocab = new Set(tokens); // initial chars count toward vocab
    const allSteps = [{ tokens: [...tokens], merge: null }];
    let safety = 0;
    while (safety < 10000) {
      const pair = findMostFrequentPair(tokens);
      if (!pair) break; // no more mergeable pairs — stop regardless of vocab size
      if (cumulativeVocab.size >= maxVocab) break; // vocab cap reached
      tokens = mergePair(tokens, pair.left, pair.right);
      cumulativeVocab.add(pair.merged); // each merge adds exactly one new token
      allSteps.push({ tokens: [...tokens], merge: pair });
      safety++;
    }
    setSteps(allSteps);
    setCurrentStep(0);
  }, []);

  useEffect(() => {
    computeSteps(inputText, vocabSize);
  }, [inputText, vocabSize, computeSteps]);

  const handleVocabSizeCommit = () => {
    const parsed = parseInt(vocabSizeInput, 10);
    if (!isNaN(parsed) && parsed >= 2 && parsed <= 5000) {
      setVocabSize(parsed);
    } else {
      setVocabSizeInput(String(vocabSize));
    }
  };

  const current = steps[currentStep] || { tokens: [], merge: null };
  const mergeHistory = steps.slice(1, currentStep + 1).map((s) => s.merge);

  const uniqueTokens = [...new Set(current.tokens)];
  const tokenFreq = {};
  current.tokens.forEach((t) => (tokenFreq[t] = (tokenFreq[t] || 0) + 1));

  const vocabCapReached =
    steps.length > 1 &&
    currentStep === steps.length - 1 &&
    uniqueTokens.length >= vocabSize;

  const noMorePairs =
    steps.length > 1 &&
    currentStep === steps.length - 1 &&
    uniqueTokens.length < vocabSize;

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(170deg, #fafafa 0%, #f0ece3 50%, #e8e4db 100%)",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: "#1a1a2e",
        padding: "0",
        overflow: "auto",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:wght@700;800&display=swap');
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        textarea:focus, button:focus-visible {
          outline: 2px solid #E07A5F;
          outline-offset: 2px;
        }
        .example-btn {
          padding: 6px 14px;
          border-radius: 20px;
          border: 1.5px solid #ddd;
          background: white;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'DM Sans', sans-serif;
          color: #555;
        }
        .example-btn:hover {
          border-color: #E07A5F;
          color: #E07A5F;
          background: #fef6f4;
        }
        .example-btn.active {
          border-color: #E07A5F;
          color: #E07A5F;
          background: #fef6f4;
          font-weight: 600;
        }
        .ctrl-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 20px;
          border-radius: 8px;
          border: 1.5px solid #ddd;
          background: white;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'DM Sans', sans-serif;
          color: #444;
          font-weight: 500;
        }
        .ctrl-btn:hover { border-color: #E07A5F; color: #E07A5F; }
        .ctrl-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .ctrl-btn.primary {
          background: #E07A5F;
          color: white;
          border-color: #E07A5F;
        }
        .ctrl-btn.primary:hover { background: #c9694f; }
        .section-card {
          background: white;
          border-radius: 14px;
          padding: 24px;
          border: 1px solid #e8e4db;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .progress-track {
          height: 4px;
          background: #eee;
          border-radius: 2px;
          overflow: hidden;
          margin-top: 16px;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #E07A5F, #F2CC8F);
          border-radius: 2px;
          transition: width 0.4s ease;
        }
        .vocab-input {
          width: 72px;
          padding: 7px 10px;
          border-radius: 8px;
          border: 1.5px solid #e0dcd4;
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          font-weight: 600;
          color: #1a1a2e;
          background: #fafaf8;
          text-align: center;
          transition: border-color 0.2s;
        }
        .vocab-input:focus {
          outline: none;
          border-color: #E07A5F;
        }
        .vocab-cap-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 20px;
          background: #F2CC8F22;
          border: 1px solid #F2CC8F88;
          font-size: 12px;
          color: #b8922a;
          font-weight: 600;
          animation: fadeSlideIn 0.3s ease;
        }
      `}</style>

      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "40px 24px 60px",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "36px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #E07A5F, #F2CC8F)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                color: "white",
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              B
            </div>
            <div>
              <h1
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "28px",
                  fontWeight: 800,
                  margin: 0,
                  letterSpacing: "-0.02em",
                  color: "#1a1a2e",
                }}
              >
                Byte Pair Encoding
              </h1>
            </div>
          </div>
          <p
            style={{
              color: "#888",
              fontSize: "15px",
              margin: "4px 0 0 52px",
              lineHeight: 1.5,
              maxWidth: "600px",
            }}
          >
            Watch how BPE builds a vocabulary by repeatedly merging the most
            frequent pair of tokens — the same algorithm behind GPT, Claude, and
            many modern LLM tokenizers.
          </p>
        </div>

        {/* Input Section */}
        <div className="section-card" style={{ marginBottom: "20px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#aaa",
              marginBottom: "12px",
            }}
          >
            Input Text
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              marginBottom: "14px",
            }}
          >
            {EXAMPLE_SENTENCES.map((ex, i) => (
              <button
                key={i}
                className={`example-btn ${inputText === ex.text ? "active" : ""}`}
                onClick={() => setInputText(ex.text)}
              >
                {ex.label}
              </button>
            ))}
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={2}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "10px",
              border: "1.5px solid #e0dcd4",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "14px",
              resize: "vertical",
              background: "#fafaf8",
              color: "#1a1a2e",
              boxSizing: "border-box",
              lineHeight: 1.6,
            }}
            placeholder="Type or paste any text..."
          />
        </div>

        {/* Tokens Display */}
        <div className="section-card" style={{ marginBottom: "20px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#aaa",
              marginBottom: "14px",
            }}
          >
            {currentStep === 0 ? "Character Sequence" : "Token Sequence"}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "3px",
              lineHeight: 2,
            }}
          >
            {current.tokens.map((token, i) => {
              const color = getTokenColor(token, colorMap);
              const isNew = current.merge && token === current.merge.merged;
              return (
                <TokenChip
                  key={`${currentStep}-${i}`}
                  token={token}
                  color={color}
                  isNew={isNew}
                  isHighlight={isNew}
                />
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div
          className="section-card"
          style={{ marginBottom: "20px", marginTop: "20px" }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "10px",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button
                className="ctrl-btn"
                disabled={currentStep === 0}
                onClick={() => setCurrentStep((s) => s - 1)}
              >
                ‹ Back
              </button>
              <button
                className="ctrl-btn primary"
                disabled={currentStep >= steps.length - 1}
                onClick={() => setCurrentStep((s) => s + 1)}
              >
                Next ›
              </button>
              <button
                className="ctrl-btn"
                disabled={currentStep === 0}
                onClick={() => setCurrentStep(0)}
              >
                Reset
              </button>

              {/* Vocab Size Setting */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginLeft: "8px",
                  paddingLeft: "16px",
                  borderLeft: "1.5px solid #eee",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#999",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                  }}
                >
                  Vocab size
                </span>
                <input
                  type="number"
                  className="vocab-input"
                  value={vocabSizeInput}
                  min={2}
                  max={5000}
                  onChange={(e) => setVocabSizeInput(e.target.value)}
                  onBlur={handleVocabSizeCommit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleVocabSizeCommit();
                  }}
                />
                {vocabCapReached && (
                  <span className="vocab-cap-badge">✓ vocab cap reached</span>
                )}
                {noMorePairs && (
                  <span
                    className="vocab-cap-badge"
                    style={{
                      background: "#eee",
                      border: "1px solid #ddd",
                      color: "#999",
                    }}
                  >
                    ✗ no more pairs (freq &lt; 2) — text too short
                  </span>
                )}
              </div>
            </div>

            <div style={{ fontSize: "12px", color: "#aaa" }}>
              Step {currentStep} of {steps.length - 1} · {current.tokens.length}{" "}
              tokens · {uniqueTokens.length} unique
            </div>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width:
                  steps.length > 1
                    ? `${(currentStep / (steps.length - 1)) * 100}%`
                    : "0%",
              }}
            />
          </div>
        </div>

        {/* Current Merge */}
        {current.merge && (
          <div
            style={{
              background: `${getTokenColor(current.merge.merged, colorMap)}10`,
              border: `1.5px solid ${getTokenColor(current.merge.merged, colorMap)}30`,
              borderRadius: "12px",
              padding: "14px 20px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              animation: "fadeSlideIn 0.3s ease",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: getTokenColor(current.merge.merged, colorMap),
              }}
            >
              Merge #{currentStep}
            </span>
            <span style={{ color: "#888", fontSize: "13px" }}>
              「{tokenToDisplay(current.merge.left)}」+「
              {tokenToDisplay(current.merge.right)}」→「
              {tokenToDisplay(current.merge.merged)}」
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: "12px",
                color: "#aaa",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              found {current.merge.count}× in sequence
            </span>
          </div>
        )}

        {/* Bottom Row: Vocabulary & Merge Rules */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
          }}
        >
          {/* Vocabulary */}
          <div className="section-card">
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#aaa",
                marginBottom: "14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>Vocabulary ({uniqueTokens.length})</span>
              {vocabSize && (
                <span
                  style={{
                    fontSize: "10px",
                    padding: "1px 7px",
                    borderRadius: "10px",
                    background:
                      uniqueTokens.length >= vocabSize ? "#F2CC8F33" : "#eee",
                    color:
                      uniqueTokens.length >= vocabSize ? "#b8922a" : "#bbb",
                    fontWeight: 600,
                    border: `1px solid ${uniqueTokens.length >= vocabSize ? "#F2CC8F88" : "#e0dcd4"}`,
                  }}
                >
                  cap: {vocabSize}
                </span>
              )}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "3px",
                maxHeight: "260px",
                overflowY: "auto",
              }}
            >
              {uniqueTokens
                .sort((a, b) => b.length - a.length || a.localeCompare(b))
                .map((token, i) => {
                  const color = getTokenColor(token, colorMap);
                  return (
                    <span
                      key={i}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "2px",
                      }}
                    >
                      <TokenChip token={token} color={color} small />
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#bbb",
                          fontFamily: "'JetBrains Mono', monospace",
                          marginRight: "4px",
                        }}
                      >
                        ×{tokenFreq[token]}
                      </span>
                    </span>
                  );
                })}
            </div>
          </div>

          {/* Merge Rules */}
          <div className="section-card">
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#aaa",
                marginBottom: "14px",
              }}
            >
              Merge Rules ({mergeHistory.length})
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                maxHeight: "260px",
                overflowY: "auto",
              }}
            >
              {mergeHistory.length === 0 ? (
                <div
                  style={{
                    color: "#ccc",
                    fontSize: "13px",
                    fontStyle: "italic",
                    padding: "8px 0",
                  }}
                >
                  No merges yet — press Next or Play
                </div>
              ) : (
                mergeHistory.map((m, i) => (
                  <MergeRuleChip
                    key={i}
                    index={i}
                    left={m.left}
                    right={m.right}
                    merged={m.merged}
                    color={getTokenColor(m.merged, colorMap)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="section-card" style={{ marginTop: "20px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#aaa",
              marginBottom: "12px",
            }}
          >
            How BPE Works
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "16px",
            }}
          >
            {[
              {
                n: "1",
                title: "Start with characters",
                desc: "Split text into individual characters (real BPE uses bytes; this is a character-level simplification)",
              },
              {
                n: "2",
                title: "Count all pairs",
                desc: "Find the most frequent adjacent token pair",
              },
              {
                n: "3",
                title: "Merge top pair",
                desc: "Replace every occurrence with a new combined token",
              },
              {
                n: "4",
                title: "Repeat",
                desc: "Continue until vocabulary reaches desired size, or no pair appears more than once",
              },
            ].map((s) => (
              <div key={s.n} style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #E07A5F22, #F2CC8F22)",
                    border: "1.5px solid #E07A5F33",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 700,
                    fontSize: "14px",
                    color: "#E07A5F",
                    marginBottom: "8px",
                  }}
                >
                  {s.n}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    marginBottom: "4px",
                    color: "#333",
                  }}
                >
                  {s.title}
                </div>
                <div
                  style={{ fontSize: "12px", color: "#999", lineHeight: 1.4 }}
                >
                  {s.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Points */}
        <div className="section-card" style={{ marginTop: "20px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#aaa",
              marginBottom: "16px",
            }}
          >
            Key Points
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {[
              {
                icon: "📚",
                title: "Training vs. Inference",
                desc: "BPE has two phases. During training, merge rules are learned from a large corpus. During inference, those rules are frozen — new text is tokenized by applying the same merges in the same learned order, greedily. The model never re-counts frequencies on new text.",
              },
              {
                icon: "🔒",
                title: "Vocabulary is fixed after training",
                desc: "How any new text gets tokenized is entirely determined by the trained vocabulary and its merge rules. The same word can tokenize differently depending on which vocabulary was used — GPT-4, LLaMA, and Claude all produce different token splits for the same input.",
              },
              {
                icon: "🌐",
                title: "Rare words & unknown characters",
                desc: "BPE handles rare or unseen words by falling back to smaller subword units or individual characters. Byte-level BPE (used by GPT-2 and others) guarantees no unknown tokens, since every possible byte is in the base vocabulary.",
              },
              {
                icon: "⚖️",
                title: "Vocabulary size is a tradeoff",
                desc: "A larger vocabulary means longer tokens and shorter sequences (faster, cheaper), but requires more memory and training data. A smaller vocabulary keeps the model lean but produces longer sequences. Real models range from ~32k (LLaMA 2) to ~100k (Claude, LLaMA 3).",
              },
            ].map((point, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "14px",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  background: "#fafaf8",
                  border: "1px solid #eeebe5",
                }}
              >
                <span
                  style={{ fontSize: "20px", lineHeight: 1.4, flexShrink: 0 }}
                >
                  {point.icon}
                </span>
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#333",
                      marginBottom: "4px",
                    }}
                  >
                    {point.title}
                  </div>
                  <div
                    style={{ fontSize: "13px", color: "#888", lineHeight: 1.6 }}
                  >
                    {point.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: "32px",
            fontSize: "12px",
            color: "#ccc",
          }}
        >
          BPE Tokenization Visualizer — interactive educational tool
        </div>
      </div>
    </div>
  );
}

/* Apple-inspired BPE Visualizer — Training & Inference phases */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";

const DEFAULT_TRAINING_TEXT = "low lower lowest";
const DEFAULT_INFERENCE_TEXT = "slowest flower";

// ── BPE Core Logic ──────────────────────────────────────────────

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

// Inference: apply frozen merge rules in order (no frequency counting)
function computeInferenceSteps(text, mergeRules) {
  if (!text || mergeRules.length === 0) return [{ tokens: getInitialTokens(text || ""), rule: null, ruleIndex: -1 }];
  let tokens = getInitialTokens(text);
  const allSteps = [{ tokens: [...tokens], rule: null, ruleIndex: -1 }];
  for (let ri = 0; ri < mergeRules.length; ri++) {
    const rule = mergeRules[ri];
    const newTokens = mergePair(tokens, rule.left, rule.right);
    if (newTokens.length < tokens.length) {
      tokens = newTokens;
      allSteps.push({ tokens: [...tokens], rule, ruleIndex: ri });
    }
  }
  return allSteps;
}

// ── Color Palette (Apple system colors) ─────────────────────────

const PALETTE = [
  "#0071E3",
  "#BF5AF2",
  "#30D158",
  "#FF9F0A",
  "#FF375F",
  "#64D2FF",
  "#AC8E68",
  "#5E5CE6",
  "#FF6482",
  "#32ADE6",
  "#FF453A",
  "#FFD60A",
  "#34C759",
  "#AF52DE",
  "#007AFF",
  "#FF9500",
  "#5856D6",
  "#FF2D55",
  "#00C7BE",
  "#A2845E",
];

function getTokenColor(token, colorMap) {
  if (!colorMap.current.has(token)) {
    const idx = colorMap.current.size % PALETTE.length;
    colorMap.current.set(token, PALETTE[idx]);
  }
  return colorMap.current.get(token);
}

// ── Presentational Components ───────────────────────────────────

function TokenChip({ token, color, isNew, isHighlight, small }) {
  const displayed = tokenToDisplay(token);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: small ? "3px 8px" : "5px 12px",
        margin: "2px",
        borderRadius: "8px",
        fontSize: small ? "12px" : "14px",
        fontFamily: "'SF Mono', ui-monospace, Menlo, Consolas, monospace",
        fontWeight: 500,
        background: isHighlight ? `${color}18` : `${color}0C`,
        border: `1px solid ${isHighlight ? color + "66" : color + "33"}`,
        color: "#1D1D1F",
        transition: "all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
        transform: isNew ? "scale(1.04)" : "scale(1)",
        boxShadow: isNew ? `0 2px 8px ${color}22` : "none",
        whiteSpace: "pre",
        letterSpacing: "0.01em",
      }}
    >
      {displayed}
    </span>
  );
}

function MergeRuleChip({ left, right, merged, color, index, active, dimmed }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 14px",
        borderRadius: "10px",
        background: active ? `${color}14` : dimmed ? "transparent" : `${color}08`,
        border: `1px solid ${active ? color + "44" : dimmed ? "#E8E8ED" : color + "18"}`,
        fontSize: "13px",
        fontFamily: "'SF Mono', ui-monospace, Menlo, Consolas, monospace",
        animation: active ? "none" : "fadeSlideIn 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
        opacity: dimmed ? 0.4 : (active ? 1 : 0),
        animationDelay: active || dimmed ? "0s" : `${index * 0.04}s`,
        transition: "all 0.3s ease",
      }}
    >
      <span
        style={{
          color: "#86868B",
          fontSize: "11px",
          fontWeight: 600,
          minWidth: "20px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
        }}
      >
        {index + 1}
      </span>
      <span style={{ color: "#1D1D1F" }}>{tokenToDisplay(left)}</span>
      <span style={{ color: "#D2D2D7", fontSize: "11px" }}>+</span>
      <span style={{ color: "#1D1D1F" }}>{tokenToDisplay(right)}</span>
      <span style={{ color: "#D2D2D7" }}>→</span>
      <span
        style={{
          padding: "2px 8px",
          borderRadius: "6px",
          background: `${color}14`,
          border: `1px solid ${color}33`,
          color: "#1D1D1F",
          fontWeight: 600,
        }}
      >
        {tokenToDisplay(merged)}
      </span>
    </div>
  );
}

// Section label helper
const SECTION_LABEL_STYLE = {
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#86868B",
  marginBottom: "16px",
};

// ── Main Component ──────────────────────────────────────────────

export default function BPEVisualizer() {
  const [activePhase, setActivePhase] = useState("training");
  const [inputText, setInputText] = useState(DEFAULT_TRAINING_TEXT);
  const [vocabSize, setVocabSize] = useState(100);
  const [vocabSizeInput, setVocabSizeInput] = useState("100");
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const colorMap = useRef(new Map());

  // Inference state
  const [inferenceText, setInferenceText] = useState(DEFAULT_INFERENCE_TEXT);
  const [inferenceCurrentStep, setInferenceCurrentStep] = useState(0);

  const computeSteps = useCallback((text, maxVocab) => {
    if (!text) return;
    colorMap.current = new Map();
    let tokens = getInitialTokens(text);
    const cumulativeVocab = new Set(tokens);
    const allSteps = [{ tokens: [...tokens], merge: null }];
    let safety = 0;
    while (safety < 10000) {
      const pair = findMostFrequentPair(tokens);
      if (!pair) break;
      if (cumulativeVocab.size >= maxVocab) break;
      tokens = mergePair(tokens, pair.left, pair.right);
      cumulativeVocab.add(pair.merged);
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

  // Training derived values
  const current = steps[currentStep] || { tokens: [], merge: null };
  const mergeHistory = steps.slice(1, currentStep + 1).map((s) => s.merge);
  const tokenFreq = {};
  current.tokens.forEach((t) => (tokenFreq[t] = (tokenFreq[t] || 0) + 1));

  // Cumulative vocabulary: base characters (always kept) + learned merge tokens
  const baseChars = steps.length > 0 ? [...new Set(steps[0].tokens)].sort() : [];
  const learnedTokens = mergeHistory.map((m) => m.merged);
  const cumulativeVocab = [...baseChars, ...learnedTokens];
  const baseCharCount = baseChars.length;
  const learnedCount = learnedTokens.length;

  const vocabCapReached =
    steps.length > 1 &&
    currentStep === steps.length - 1 &&
    cumulativeVocab.length >= vocabSize;

  const noMorePairs =
    steps.length > 1 &&
    currentStep === steps.length - 1 &&
    cumulativeVocab.length < vocabSize;

  // All merge rules from complete training (for inference)
  const frozenMergeRules = useMemo(() => {
    return steps.slice(1).map((s) => ({
      left: s.merge.left,
      right: s.merge.right,
      merged: s.merge.merged,
    }));
  }, [steps]);

  // Inference computation
  const inferenceSteps = useMemo(() => {
    return computeInferenceSteps(inferenceText, frozenMergeRules);
  }, [inferenceText, frozenMergeRules]);

  useEffect(() => {
    setInferenceCurrentStep(0);
  }, [inferenceText, frozenMergeRules]);

  const infCurrent = inferenceSteps[inferenceCurrentStep] || { tokens: [], rule: null, ruleIndex: -1 };
  const infUniqueTokens = [...new Set(infCurrent.tokens)];
  const infTokenFreq = {};
  infCurrent.tokens.forEach((t) => (infTokenFreq[t] = (infTokenFreq[t] || 0) + 1));

  // Which rule indices have been applied up to current inference step
  const appliedRuleIndices = new Set(
    inferenceSteps.slice(1, inferenceCurrentStep + 1).map((s) => s.ruleIndex)
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F5F7",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
        color: "#1D1D1F",
        padding: "0",
        overflow: "auto",
      }}
    >
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        textarea:focus, button:focus-visible {
          outline: 3px solid rgba(0, 113, 227, 0.4);
          outline-offset: 1px;
        }
        .ctrl-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 20px;
          border-radius: 980px;
          border: 1px solid #D2D2D7;
          background: #FFFFFF;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
          color: #1D1D1F;
          font-weight: 500;
        }
        .ctrl-btn:hover {
          border-color: #0071E3;
          color: #0071E3;
        }
        .ctrl-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .ctrl-btn:disabled:hover {
          border-color: #D2D2D7;
          color: #1D1D1F;
        }
        .ctrl-btn.primary {
          background: #0071E3;
          color: #FFFFFF;
          border-color: #0071E3;
        }
        .ctrl-btn.primary:hover {
          background: #0077ED;
        }
        .ctrl-btn.inference {
          border-color: #BF5AF2;
          color: #FFFFFF;
          background: #BF5AF2;
        }
        .ctrl-btn.inference:hover {
          background: #A84BD6;
        }
        .section-card {
          background: #FFFFFF;
          border-radius: 16px;
          padding: 24px;
          border: none;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.04);
        }
        .progress-track {
          height: 3px;
          background: #E8E8ED;
          border-radius: 2px;
          overflow: hidden;
          margin-top: 16px;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #0071E3, #2997FF);
          border-radius: 2px;
          transition: width 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
        }
        .progress-fill.inference {
          background: linear-gradient(90deg, #BF5AF2, #DA8FFF);
        }
        .vocab-input {
          width: 72px;
          padding: 7px 10px;
          border-radius: 8px;
          border: 1px solid #D2D2D7;
          font-family: 'SF Mono', ui-monospace, Menlo, monospace;
          font-size: 14px;
          font-weight: 600;
          color: #1D1D1F;
          background: #F5F5F7;
          text-align: center;
          transition: border-color 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
        }
        .vocab-input:focus {
          outline: none;
          border-color: #0071E3;
          box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.2);
        }
        .vocab-cap-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 12px;
          border-radius: 980px;
          background: rgba(52, 199, 89, 0.1);
          border: 1px solid rgba(52, 199, 89, 0.3);
          font-size: 12px;
          color: #248A3D;
          font-weight: 600;
          animation: fadeSlideIn 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
        }
        .phase-tabs {
          display: flex;
          background: #E8E8ED;
          border-radius: 980px;
          padding: 3px;
          width: fit-content;
        }
        .phase-tab {
          padding: 8px 24px;
          border-radius: 980px;
          border: none;
          background: transparent;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
          color: #86868B;
        }
        .phase-tab.active {
          background: #FFFFFF;
          color: #1D1D1F;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .phase-tab:not(.active):hover {
          color: #1D1D1F;
        }
        @media (max-width: 430px) {
          .section-card {
            padding: 16px;
            border-radius: 12px;
          }
          .phase-tab {
            padding: 8px 16px;
            font-size: 13px;
          }
        }
      `}</style>

      <div
        style={{
          maxWidth: "980px",
          margin: "0 auto",
          padding: "48px 24px 64px",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #0071E3, #2997FF)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                color: "white",
                fontWeight: 600,
                fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
              }}
            >
              B
            </div>
            <div>
              <h1
                style={{
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
                  fontSize: "32px",
                  fontWeight: 600,
                  margin: 0,
                  letterSpacing: "-0.022em",
                  color: "#1D1D1F",
                  lineHeight: 1.1,
                }}
              >
                Byte Pair Encoding
              </h1>
            </div>
          </div>
          <p
            style={{
              color: "#86868B",
              fontSize: "17px",
              margin: "8px 0 0 0",
              lineHeight: 1.47,
              textAlign: "left",
            }}
          >
            Step through both phases of BPE — train a tokenizer by learning
            merge rules from a corpus, then see how those frozen rules tokenize
            new text at inference.
          </p>
        </div>

        {/* Phase Tabs */}
        <div style={{ marginBottom: "24px" }}>
          <div className="phase-tabs">
            <button
              className={`phase-tab ${activePhase === "training" ? "active" : ""}`}
              onClick={() => setActivePhase("training")}
            >
              Phase 1: Training
            </button>
            <button
              className={`phase-tab ${activePhase === "inference" ? "active" : ""}`}
              onClick={() => setActivePhase("inference")}
              disabled={frozenMergeRules.length === 0}
              style={frozenMergeRules.length === 0 ? { opacity: 0.4, cursor: "not-allowed" } : {}}
            >
              Phase 2: Inference
            </button>
          </div>
          {frozenMergeRules.length === 0 && activePhase === "training" && (
            <p style={{ fontSize: "13px", color: "#86868B", marginTop: "8px" }}>
              Enter a training corpus to learn merge rules, then switch to Inference.
            </p>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* PHASE 1: TRAINING                                      */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activePhase === "training" && (
          <>
            {/* Training Corpus Input */}
            <div className="section-card" style={{ marginBottom: "16px" }}>
              <div style={SECTION_LABEL_STYLE}>
                Training Corpus
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={2}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  border: "1px solid #D2D2D7",
                  fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
                  fontSize: "14px",
                  resize: "vertical",
                  background: "#F5F5F7",
                  color: "#1D1D1F",
                  boxSizing: "border-box",
                  lineHeight: 1.6,
                  transition: "border-color 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
                }}
                placeholder="Enter training text..."
              />
            </div>

            {/* Token Sequence */}
            <div className="section-card" style={{ marginBottom: "16px" }}>
              <div style={{ ...SECTION_LABEL_STYLE, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>{currentStep === 0 ? "Character Sequence" : "Token Sequence"}</span>
                <span style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#0071E3",
                  textTransform: "none",
                  letterSpacing: "normal",
                  fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
                }}>
                  {baseCharCount} initial + {learnedCount} learned = {baseCharCount + learnedCount} vocab
                </span>
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

            {/* Vocabulary & Merge Rules */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              {/* Vocabulary */}
              <div className="section-card">
                <div
                  style={{
                    ...SECTION_LABEL_STYLE,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>Vocabulary (<span style={{ color: "#0071E3" }}>{cumulativeVocab.length}</span>)</span>
                  {vocabSize && (
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "980px",
                        background:
                          cumulativeVocab.length >= vocabSize ? "rgba(52, 199, 89, 0.1)" : "#F5F5F7",
                        color:
                          cumulativeVocab.length >= vocabSize ? "#248A3D" : "#86868B",
                        fontWeight: 600,
                        border: `1px solid ${cumulativeVocab.length >= vocabSize ? "rgba(52, 199, 89, 0.3)" : "#D2D2D7"}`,
                      }}
                    >
                      cap: {vocabSize}
                    </span>
                  )}
                </div>
                {/* Base characters */}
                <div style={{ fontSize: "11px", color: "#86868B", marginBottom: "8px", fontWeight: 500 }}>
                  Initial character tokens ({baseCharCount})
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "3px",
                    marginBottom: learnedCount > 0 ? "16px" : "0",
                  }}
                >
                  {baseChars.map((token, i) => {
                    const color = getTokenColor(token, colorMap);
                    return (
                      <TokenChip key={`base-${i}`} token={token} color={color} small />
                    );
                  })}
                </div>
                {/* Learned merge tokens */}
                {learnedCount > 0 && (
                  <>
                    <div style={{ fontSize: "11px", color: "#0071E3", marginBottom: "8px", fontWeight: 500 }}>
                      + Learned tokens ({learnedCount})
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "3px",
                        maxHeight: "180px",
                        overflowY: "auto",
                      }}
                    >
                      {learnedTokens.map((token, i) => {
                        const color = getTokenColor(token, colorMap);
                        const isLatest = i === learnedCount - 1;
                        return (
                          <TokenChip key={`learned-${i}`} token={token} color={color} small isNew={isLatest} isHighlight={isLatest} />
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Merge Rules */}
              <div className="section-card">
                <div style={SECTION_LABEL_STYLE}>
                  Learned Merge Rules (<span style={{ color: "#0071E3" }}>{mergeHistory.length}</span>)
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    maxHeight: "280px",
                    overflowY: "auto",
                  }}
                >
                  {mergeHistory.length === 0 ? (
                    <div
                      style={{
                        color: "#A1A1A6",
                        fontSize: "14px",
                        fontStyle: "italic",
                        padding: "8px 0",
                      }}
                    >
                      No merges yet — press Next Merge to learn rules
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

            {/* Controls */}
            <div
              className="section-card"
              style={{ marginTop: "16px", marginBottom: "16px" }}
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
                    Next Merge ›
                  </button>
                  <button
                    className="ctrl-btn"
                    disabled={currentStep === 0}
                    onClick={() => setCurrentStep(0)}
                  >
                    Reset
                  </button>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginLeft: "8px",
                      paddingLeft: "16px",
                      borderLeft: "1px solid #D2D2D7",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#86868B",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Vocab cap
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
                          background: "rgba(0, 0, 0, 0.04)",
                          border: "1px solid #D2D2D7",
                          color: "#86868B",
                        }}
                      >
                        ✗ no more pairs (freq &lt; 2)
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: "13px", color: "#86868B", fontWeight: 400 }}>
                  Step {currentStep} of {steps.length - 1}
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

            {/* Current Merge Info */}
            {current.merge && (
              <div
                style={{
                  background: `${getTokenColor(current.merge.merged, colorMap)}0A`,
                  border: `1px solid ${getTokenColor(current.merge.merged, colorMap)}22`,
                  borderRadius: "14px",
                  padding: "16px 24px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                  animation: "fadeSlideIn 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: getTokenColor(current.merge.merged, colorMap),
                  }}
                >
                  Merge #{currentStep}
                </span>
                <span style={{ color: "#86868B", fontSize: "14px" }}>
                  「{tokenToDisplay(current.merge.left)}」+「
                  {tokenToDisplay(current.merge.right)}」→「
                  {tokenToDisplay(current.merge.merged)}」
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "13px",
                    color: "#86868B",
                    fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
                  }}
                >
                  found {current.merge.count}× in corpus
                </span>
              </div>
            )}

            {/* Try Inference CTA */}
            {frozenMergeRules.length > 0 && (
              <div
                style={{
                  marginTop: "24px",
                  padding: "20px 24px",
                  borderRadius: "16px",
                  background: "linear-gradient(135deg, rgba(191, 90, 242, 0.06), rgba(0, 113, 227, 0.06))",
                  border: "1px solid rgba(191, 90, 242, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "#1D1D1F", marginBottom: "4px" }}>
                    Training complete — {frozenMergeRules.length} merge rules learned
                  </div>
                  <div style={{ fontSize: "13px", color: "#86868B" }}>
                    Now see how these frozen rules tokenize new, unseen text.
                  </div>
                </div>
                <button
                  className="ctrl-btn inference"
                  onClick={() => setActivePhase("inference")}
                >
                  Try Inference →
                </button>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* PHASE 2: INFERENCE                                     */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activePhase === "inference" && (
          <>
            {/* Inference Input */}
            <div className="section-card" style={{ marginBottom: "16px" }}>
              <div style={SECTION_LABEL_STYLE}>
                New Text (unseen during training)
              </div>
              <textarea
                value={inferenceText}
                onChange={(e) => setInferenceText(e.target.value)}
                rows={2}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  border: "1px solid #D2D2D7",
                  fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
                  fontSize: "14px",
                  resize: "vertical",
                  background: "#F5F5F7",
                  color: "#1D1D1F",
                  boxSizing: "border-box",
                  lineHeight: 1.6,
                  transition: "border-color 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
                }}
                placeholder="Enter new text to tokenize..."
              />
            </div>

            {/* Inference Token Sequence */}
            <div className="section-card" style={{ marginBottom: "16px" }}>
              <div style={{ ...SECTION_LABEL_STYLE, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>{inferenceCurrentStep === 0 ? "Character Sequence" : "Tokenized Output"}</span>
                <span style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#BF5AF2",
                  textTransform: "none",
                  letterSpacing: "normal",
                  fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
                }}>
                  {infCurrent.tokens.length} tokens · {[...inferenceText].length} characters · {infUniqueTokens.length} unique
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "3px",
                  lineHeight: 2,
                }}
              >
                {infCurrent.tokens.map((token, i) => {
                  const color = getTokenColor(token, colorMap);
                  const isNew = infCurrent.rule && token === infCurrent.rule.merged;
                  return (
                    <TokenChip
                      key={`inf-${inferenceCurrentStep}-${i}`}
                      token={token}
                      color={color}
                      isNew={isNew}
                      isHighlight={isNew}
                    />
                  );
                })}
              </div>
            </div>

            {/* Frozen Rules from Training + Inference Vocabulary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              {/* Frozen Merge Rules */}
              <div className="section-card">
                <div style={SECTION_LABEL_STYLE}>
                  Frozen Rules from Training ({frozenMergeRules.length})
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    maxHeight: "280px",
                    overflowY: "auto",
                  }}
                >
                  {frozenMergeRules.map((m, i) => {
                    const isApplied = appliedRuleIndices.has(i);
                    const isCurrentRule = infCurrent.ruleIndex === i;
                    return (
                      <MergeRuleChip
                        key={i}
                        index={i}
                        left={m.left}
                        right={m.right}
                        merged={m.merged}
                        color={isApplied || isCurrentRule ? "#BF5AF2" : "#86868B"}
                        active={isCurrentRule}
                        dimmed={!isApplied && !isCurrentRule}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Inference Vocabulary */}
              <div className="section-card">
                <div
                  style={{
                    ...SECTION_LABEL_STYLE,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>Unique Tokens in Output ({infUniqueTokens.length})</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "3px",
                    maxHeight: "280px",
                    overflowY: "auto",
                  }}
                >
                  {infUniqueTokens
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
                              color: "#A1A1A6",
                              fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
                              marginRight: "4px",
                            }}
                          >
                            ×{infTokenFreq[token]}
                          </span>
                        </span>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Inference Controls */}
            <div
              className="section-card"
              style={{ marginTop: "16px", marginBottom: "16px" }}
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
                    disabled={inferenceCurrentStep === 0}
                    onClick={() => setInferenceCurrentStep((s) => s - 1)}
                  >
                    ‹ Back
                  </button>
                  <button
                    className="ctrl-btn inference"
                    disabled={inferenceCurrentStep >= inferenceSteps.length - 1}
                    onClick={() => setInferenceCurrentStep((s) => s + 1)}
                  >
                    Apply Rule ›
                  </button>
                  <button
                    className="ctrl-btn"
                    disabled={inferenceCurrentStep === 0}
                    onClick={() => setInferenceCurrentStep(0)}
                  >
                    Reset
                  </button>
                </div>

                <div style={{ fontSize: "13px", color: "#86868B", fontWeight: 400 }}>
                  {inferenceCurrentStep === 0
                    ? `${inferenceSteps.length - 1} rules match this text`
                    : `Rule ${inferenceCurrentStep} of ${inferenceSteps.length - 1} applied`
                  }
                </div>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill inference"
                  style={{
                    width:
                      inferenceSteps.length > 1
                        ? `${(inferenceCurrentStep / (inferenceSteps.length - 1)) * 100}%`
                        : "0%",
                  }}
                />
              </div>
            </div>

            {/* Current Rule Application */}
            {infCurrent.rule && (
              <div
                style={{
                  background: "rgba(191, 90, 242, 0.06)",
                  border: "1px solid rgba(191, 90, 242, 0.2)",
                  borderRadius: "14px",
                  padding: "16px 24px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                  animation: "fadeSlideIn 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#BF5AF2",
                  }}
                >
                  Rule #{infCurrent.ruleIndex + 1}
                </span>
                <span style={{ color: "#86868B", fontSize: "14px" }}>
                  「{tokenToDisplay(infCurrent.rule.left)}」+「
                  {tokenToDisplay(infCurrent.rule.right)}」→「
                  {tokenToDisplay(infCurrent.rule.merged)}」
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "12px",
                    color: "#86868B",
                    padding: "3px 10px",
                    borderRadius: "980px",
                    background: "rgba(191, 90, 242, 0.08)",
                    border: "1px solid rgba(191, 90, 242, 0.15)",
                  }}
                >
                  no counting — pattern match only
                </span>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* EDUCATIONAL CONTENT (always visible)                   */}
        {/* ═══════════════════════════════════════════════════════ */}

        {/* How it works — two phases */}
        <div className="section-card" style={{ marginTop: "32px" }}>
          <div style={SECTION_LABEL_STYLE}>
            How BPE Works
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Training phase */}
            <div>
              <div style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#0071E3",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}>
                <span style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "rgba(0, 113, 227, 0.1)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                }}>1</span>
                Training — learn merge rules from a corpus
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "24px",
                }}
              >
                {[
                  {
                    n: "A",
                    title: "Start with characters",
                    desc: "Split corpus into individual characters. These form the base vocabulary.",
                  },
                  {
                    n: "B",
                    title: "Count adjacent pairs",
                    desc: "Find which pair of adjacent tokens appears most frequently in the corpus.",
                  },
                  {
                    n: "C",
                    title: "Merge & add to vocab",
                    desc: "Create a new token from the top pair. Vocab GROWS — original tokens are never deleted.",
                  },
                  {
                    n: "D",
                    title: "Repeat",
                    desc: "Continue until vocab reaches desired size. Output: vocabulary + ordered merge rules.",
                  },
                ].map((s) => (
                  <div key={s.n} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "rgba(0, 113, 227, 0.08)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 600,
                        fontSize: "13px",
                        color: "#0071E3",
                        marginBottom: "10px",
                      }}
                    >
                      {s.n}
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        marginBottom: "4px",
                        color: "#1D1D1F",
                      }}
                    >
                      {s.title}
                    </div>
                    <div
                      style={{ fontSize: "13px", color: "#86868B", lineHeight: 1.47 }}
                    >
                      {s.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ height: "1px", background: "#E8E8ED" }} />

            {/* Inference phase */}
            <div>
              <div style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#BF5AF2",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}>
                <span style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "rgba(191, 90, 242, 0.1)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                }}>2</span>
                Inference — tokenize new text with frozen rules
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "24px",
                }}
              >
                {[
                  {
                    n: "A",
                    title: "Start with characters",
                    desc: "Split new (unseen) text into characters — same as training, but no frequency counting happens.",
                  },
                  {
                    n: "B",
                    title: "Apply rules in order",
                    desc: "Walk through the merge rules list in the exact order they were learned. Apply each rule that matches.",
                  },
                  {
                    n: "C",
                    title: "Output token IDs",
                    desc: "Look up each resulting token in the vocabulary to get numeric IDs — the neural network's actual input.",
                  },
                ].map((s) => (
                  <div key={s.n} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "rgba(191, 90, 242, 0.08)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 600,
                        fontSize: "13px",
                        color: "#BF5AF2",
                        marginBottom: "10px",
                      }}
                    >
                      {s.n}
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        marginBottom: "4px",
                        color: "#1D1D1F",
                      }}
                    >
                      {s.title}
                    </div>
                    <div
                      style={{ fontSize: "13px", color: "#86868B", lineHeight: 1.47 }}
                    >
                      {s.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Key Points */}
        <div className="section-card" style={{ marginTop: "16px" }}>
          <div style={SECTION_LABEL_STYLE}>
            Key Concepts
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "8px" }}
          >
            {[
              {
                icon: "📈",
                title: "Vocab grows, not shrinks",
                desc: "Each merge adds a new token to the vocabulary — original characters are never deleted. GPT-2 starts with 256 bytes and ends with 50,257 tokens. This is why we set a vocab cap.",
              },
              {
                icon: "🔒",
                title: "Rules are frozen after training",
                desc: "At inference, the merge rules and their order are fixed. New text is tokenized by applying those same rules in sequence — no frequency counting happens. The model never re-learns from new input.",
              },
              {
                icon: "🧩",
                title: "Unseen words decompose into subwords",
                desc: "A word never seen during training (like \"slowest\") still gets tokenized — BPE falls back to learned subword pieces. This is why BPE has no \"unknown token\" problem.",
              },
              {
                icon: "⚖️",
                title: "Vocabulary size is a tradeoff",
                desc: "Larger vocab = longer tokens, shorter sequences (faster, cheaper) but more memory. Smaller vocab = shorter tokens, longer sequences. Real models: ~32k (LLaMA 2) to ~200k (GPT-4o).",
              },
            ].map((point, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "16px",
                  padding: "16px",
                  borderRadius: "12px",
                  background: "#F5F5F7",
                  border: "none",
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
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#1D1D1F",
                      marginBottom: "4px",
                    }}
                  >
                    {point.title}
                  </div>
                  <div
                    style={{ fontSize: "14px", color: "#86868B", lineHeight: 1.6 }}
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
            marginTop: "48px",
            fontSize: "12px",
            color: "#A1A1A6",
            letterSpacing: "0.01em",
          }}
        >
          BPE Tokenization Visualizer — interactive educational tool
        </div>
      </div>
    </div>
  );
}

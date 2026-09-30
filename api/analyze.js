export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    return res.status(500).json({
      error: "لم يتم إعداد OPENAI_API_KEY في Vercel بعد."
    });
  }

  let body;

  try {
    body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body;
  } catch {
    return res.status(400).json({
      error: "بيانات الطلب غير صحيحة."
    });
  }

  const mode = body?.mode;
  const input = String(body?.input || "").trim();

  if (!input) {
    return res.status(400).json({
      error: "أدخل رابطًا أو اسم منتج."
    });
  }

  if (
    mode === "url" &&
    !/^https?:\/\//i.test(input)
  ) {
    return res.status(400).json({
      error: "الرابط يجب أن يبدأ بـ http:// أو https://."
    });
  }

  let pageMeta = "";

  if (mode === "url") {
    try {
      const controller = new AbortController();

      const timer = setTimeout(
        () => controller.abort(),
        7000
      );

      const r = await fetch(input, {
        headers: {
          "user-agent":
            "Mozilla/5.0 DZ-Product-Intelligence/1.0"
        },
        signal: controller.signal
      });

      clearTimeout(timer);

      const html = await r.text();

      const title =
        (
          html.match(
            /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i
          )?.[1] ||
          html.match(
            /<title[^>]*>([^<]+)<\/title>/i
          )?.[1] ||
          ""
        ).slice(0, 300);

      const desc =
        (
          html.match(
            /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/i
          )?.[1] || ""
        ).slice(0, 500);

      pageMeta =
        `صفحة المصدر أعادت العنوان: ${title}. الوصف: ${desc}.`;
    } catch (e) {
      pageMeta =
        "تعذر جلب الصفحة مباشرة؛ استخدم الرابط نفسه كمصدر أولي وحاول البحث عنه عبر الويب.";
    }
  }

  const schema = {
    type: "object",
    additionalProperties: false,

    properties: {
      product_name: { type: "string" },
      category: { type: "string" },
      brand: { type: "string" },
      model: { type: "string" },
      identity_notes: { type: "string" },
      market_summary: { type: "string" },

      decision: {
        type: "string",
        enum: [
          "TEST",
          "VALIDATE MORE",
          "HIGH RISK"
        ]
      },

      decision_reason: { type: "string" },

      confidence: {
        type: "integer"
      },

      buy_cost_da: { type: "string" },
      extra_cost_da: { type: "string" },
      retail_price_da: { type: "string" },
      gross_margin_da: { type: "string" },
      economics_note: { type: "string" },

      market_prices: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,

          properties: {
            title: { type: "string" },
            price_da: { type: "string" },
            match_level: { type: "string" },
            source: { type: "string" },
            url: { type: "string" },
            observed_at: { type: "string" }
          },

          required: [
            "title",
            "price_da",
            "match_level",
            "source",
            "url",
            "observed_at"
          ]
        }
      },

      competitors: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,

          properties: {
            seller: { type: "string" },
            product: { type: "string" },
            price_da: { type: "string" },
            source: { type: "string" },
            url: { type: "string" }
          },

          required: [
            "seller",
            "product",
            "price_da",
            "source",
            "url"
          ]
        }
      },

      risks: {
        type: "array",
        items: { type: "string" }
      },

      next_actions: {
        type: "array",
        items: { type: "string" }
      },

      sources: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,

          properties: {
            title: { type: "string" },
            url: { type: "string" },
            observed_at: { type: "string" }
          },

          required: [
            "title",
            "url",
            "observed_at"
          ]
        }
      }
    },

    required: [
      "product_name",
      "category",
      "brand",
      "model",
      "identity_notes",
      "market_summary",
      "decision",
      "decision_reason",
      "confidence",
      "buy_cost_da",
      "extra_cost_da",
      "retail_price_da",
      "gross_margin_da",
      "economics_note",
      "market_prices",
      "competitors",
      "risks",
      "next_actions",
      "sources"
    ]
  };

  const prompt = `
أنت محرك Product Intelligence لمنتجات التجارة الإلكترونية في الجزائر.

حلل المنتج التالي:
${input}

${pageMeta}

إذا كان رابطًا، اعتبره مصدرًا أوليًا للهوية فقط ولا تثق بأي سعر منه إلا إذا كان واضحًا.

استخدم web_search للبحث عن:

1) نفس المنتج أو الموديل في الجزائر، مع أولوية للمصادر الجزائرية العامة.
2) Ouedkniss، المتاجر الجزائرية، وصفحات البيع العامة.
3) مصادر المورد أو السعر الأصلي عند الحاجة، لكن لا تعتبر سعر المورد سعر بيع جزائري.

ابحث أيضًا بالاسم العربي والفرنسي والإنجليزي إن كان ذلك مفيدًا.

قواعد صارمة:

- لا تخترع أي سعر أو بائع أو رابط.
- كل سعر جزائري يجب أن يكون مدعومًا بمصدر ورابط وتاريخ رصد.
- إذا لم تجد بيانات موثوقة، اكتب "غير متوفر" بدل التخمين.
- ميّز بين نفس المنتج والمشابه.
- لا تستخدم أسعارًا قديمة على أنها حالية؛ اذكر تاريخ الرصد.
- لا تعتبر نتائج البحث وحدها دليلًا على حجم الطلب؛ استخدم "إشارة" فقط إذا كان هناك دليل.
- القرار TEST/VALIDATE MORE/HIGH RISK هو تلخيص مبني على البيانات المتاحة وليس ضمانًا للربح.
- buy_cost_da و extra_cost_da و gross_margin_da يجب أن تكون "غير متوفر" إذا لم توجد أرقام كافية.
- confidence من 0 إلى 100 ويعكس جودة الأدلة، لا احتمال الربح.

أخرج JSON مطابقًا للمخطط فقط.
`;

  try {
    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        },

        body: JSON.stringify({
          model: "gpt-5",

          tools: [
            {
              type: "web_search"
            }
          ],

          input: prompt,

          text: {
            format: {
              type: "json_schema",
              name: "dz_product_report",
              strict: true,
              schema
            }
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "فشل اتصال OpenAI."
      });
    }

    const text = data.output_text;

    let report;

    try {
      report = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error:
          "تعذر تحويل نتيجة التحليل إلى تقرير منظم."
      });
    }

    return res.status(200).json(report);

  } catch (e) {
    return res.status(500).json({
      error:
        "حدث خطأ أثناء الاتصال بخدمة التحليل."
    });
  }
                                }

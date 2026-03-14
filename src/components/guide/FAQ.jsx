function FAQ() {
  const faqs = [
    {
      q: "Can I send or edit messages through Sapper?",
      a: "Not yet. Sapper is currently a viewer and organiser for exported conversations. Sending and editing messages may be added in a future update.",
    },
    {
      q: "Does HTML / CSV / plaintext export work?",
      a: "Not yet. Only JSON exports are supported at this time.",
    },
    {
      q: "Can I import from apps other than DiscordChatExporter?",
      a: "As long as the file follows the same format that DiscordChatExporter produces, it should work. Other tools or custom exports may not be compatible.",
    },
    {
      q: "Do member edits affect the original file?",
      a: "No. All edits (names, avatars, visibility) are stored separately inside Sapper. Your original export is never modified.",
    },
    {
      q: "What happens if I move or delete the original export files after importing?",
      a: "Nothing breaks. Sapper makes its own copy of the data during import. The original files are only needed if you want to re-import later.",
    },
    {
      q: "Is there a message limit?",
      a: "No hard limit. Sapper loads messages in batches, so even conversations with hundreds of thousands of messages should work smoothly.",
    },
    {
      q: "Can I use Sapper on Mac or Linux?",
      a: "Sapper is currently built for Windows. Other platforms may be supported in the future.",
    },
  ];

  return (
    <div className="guide-page">
      <h2 className="guide-page-title">FAQ</h2>

      <div className="guide-faq-list">
        {faqs.map((faq, i) => (
          <div key={i} className="guide-faq-item">
            <div className="guide-faq-question">{faq.q}</div>
            <div className="guide-faq-answer">{faq.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FAQ;

import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const renderContent = () => {
    // This is a very simple and safe markdown-to-JSX parser
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc pl-5 space-y-1 my-3">
            {listItems.map((item, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
            ))}
          </ul>
        );
        listItems = [];
      }
    };
    
    lines.forEach((line, index) => {
      // Sanitize and format basic markdown
      let formattedLine = line
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-100">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');

      if (formattedLine.startsWith('## ')) {
        flushList();
        elements.push(<h3 className="text-xl font-bold text-slate-100 mt-4 mb-2" key={index} dangerouslySetInnerHTML={{ __html: formattedLine.substring(3) }} />);
      } else if (formattedLine.startsWith('# ')) {
        flushList();
        elements.push(<h2 className="text-2xl font-extrabold text-white mt-5 mb-3" key={index} dangerouslySetInnerHTML={{ __html: formattedLine.substring(2) }} />);
      } else if (formattedLine.startsWith('* ') || formattedLine.startsWith('- ')) {
        listItems.push(formattedLine.substring(2));
      } else {
        flushList();
        if (formattedLine.trim() !== '') {
          elements.push(<p className="my-2" key={index} dangerouslySetInnerHTML={{ __html: formattedLine }} />);
        } else if (elements.length > 0 && lines[index-1]?.trim() !== '') {
          // Add a line break for empty lines between text blocks
          elements.push(<br key={`br-${index}`} />);
        }
      }
    });

    flushList(); // Flush any remaining list items
    return elements;
  };

  return <div className="prose prose-invert max-w-none text-slate-300">{renderContent()}</div>;
};

export default MarkdownRenderer;

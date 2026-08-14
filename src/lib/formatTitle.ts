export const formatTitle = (title: string): string => {
	// Replace hyphens with spaces
	let formatted = title.replace(/-/g, " ");
	
	// Handle camelCase by adding spaces before capital letters
	let result = "";
	for (let i = 0; i < formatted.length; i++) {
		const char = formatted[i];
		const nextChar = formatted[i + 1];
		
		// If current char is lowercase and next char is uppercase, add space
		if (char >= 'a' && char <= 'z' && nextChar && nextChar >= 'A' && nextChar <= 'Z') {
			result += char + " ";
		} else {
			result += char;
		}
	}
	
	// Handle numbers - add spaces around numbers
	let withNumbers = "";
	for (let i = 0; i < result.length; i++) {
		const char = result[i];
		const prevChar = result[i - 1];
		const nextChar = result[i + 1];
		
		// If current char is a digit
		if (char >= '0' && char <= '9') {
			// Add space before if previous char is not a space and not a digit
			if (prevChar && prevChar !== ' ' && (prevChar < '0' || prevChar > '9')) {
				withNumbers += " ";
			}
			withNumbers += char;
			// Add space after if next char is not a space and not a digit
			if (nextChar && nextChar !== ' ' && (nextChar < '0' || nextChar > '9')) {
				withNumbers += " ";
			}
		} else {
			withNumbers += char;
		}
	}
	
	// Clean up multiple spaces
	formatted = withNumbers.replace(/\s+/g, " ").trim();
	
	// Capitalize first letter of each word, but preserve acronyms
	let final = "";
	const words = formatted.split(" ");
	for (const word of words) {
		if (word.length > 0) {
			// If the word is all uppercase (like an acronym), keep it as is
			if (word === word.toUpperCase() && word.length > 1) {
				final += word + " ";
			} else {
				// Otherwise, capitalize first letter and lowercase the rest
				final += word[0].toUpperCase() + word.slice(1).toLowerCase() + " ";
			}
		}
	}
	
	return final.trim();
}; 
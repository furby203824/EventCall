#!/usr/bin/env python3
"""
Replace hardcoded hex colors with CSS variable references.
Rules:
- Do NOT replace inside :root {} block in styles.css
- Do NOT replace inside comments
- Do NOT replace inside rgba() or gradient color stops
- Do NOT replace inside url("data:...") strings
- Do NOT replace inside content: strings
- Do NOT replace #ffffff or #fff
- Only replace standalone hex properties
"""

import re
import sys
import os

# Color mapping (case insensitive)
COLOR_MAP = {
    '#5C4E4E': 'var(--ux2-gold)',
    '#000000': 'var(--ux2-navy-900)',
    '#988686': 'var(--ux2-text-muted)',
    '#D1D0D0': 'var(--ux2-text-light)',
    '#E8E7E7': 'var(--gray-50)',
}

def is_in_comment(line):
    """Check if the line is a CSS comment line."""
    stripped = line.strip()
    if stripped.startswith('/*') or stripped.startswith('*') or stripped.startswith('//'):
        return True
    return False

def is_in_gradient(line, hex_val, pos):
    """Check if the hex value is inside a gradient color stop (has % or 'deg' nearby)."""
    # Check if hex is followed by a percentage (gradient stop)
    after = line[pos + len(hex_val):].lstrip()
    if after and (after[0] == '%' or after.startswith('0%') or after.startswith('100%') or after.startswith('50%')):
        return True
    # Check for common gradient patterns
    if re.search(r'\d+%', after[:10]) if len(after) >= 1 else False:
        return True
    # More precise: check if this hex is followed by whitespace then a number then %
    match = re.match(r'\s*\d+%', after)
    if match:
        return True
    return False

def is_in_url_or_content(line):
    """Check if the line contains url() or content: with the hex inside a string."""
    if 'url(' in line.lower():
        return True
    if 'content:' in line.lower() and ('"' in line or "'" in line):
        return True
    return False

def should_replace(line, hex_val, pos):
    """Determine if a hex value at a given position in a line should be replaced."""
    # Skip comments
    if is_in_comment(line):
        return False

    # Skip if inside url()
    if is_in_url_or_content(line):
        return False

    # Check if inside a gradient (hex followed by percentage)
    after_hex = line[pos + len(hex_val):]
    # Pattern: hex followed by optional space then digits then %
    if re.match(r'\s+\d+%', after_hex) or re.match(r'\d+%', after_hex):
        return False

    # Check if preceded by gradient context (linear-gradient, radial-gradient)
    before_hex = line[:pos]
    # Check if we're inside a gradient function
    # Find the last unclosed parenthesis context
    paren_depth = 0
    last_func = ''
    i = 0
    while i < len(before_hex):
        # Track function names before parentheses
        if before_hex[i] == '(':
            paren_depth += 1
            # Find the function name
            func_start = i - 1
            while func_start >= 0 and (before_hex[func_start].isalpha() or before_hex[func_start] == '-'):
                func_start -= 1
            func_start += 1
            last_func = before_hex[func_start:i].strip().lower()
        elif before_hex[i] == ')':
            paren_depth -= 1
        i += 1

    if paren_depth > 0 and 'gradient' in last_func:
        return False

    # Check if inside rgba/rgb/hsl
    if paren_depth > 0 and last_func in ('rgba', 'rgb', 'hsl', 'hsla'):
        return False

    return True

def process_file(filepath, skip_root_block=False, skip_after_line=None):
    """Process a single CSS file and replace hex colors."""
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()

    changes = 0
    in_root_block = False
    root_brace_depth = 0
    in_comment_block = False

    new_lines = []
    for line_num, line in enumerate(lines, 1):
        # Track block comment state
        if '/*' in line:
            in_comment_block = True
        if '*/' in line:
            # The rest after */ is not in a comment
            comment_end = line.index('*/') + 2
            in_comment_block_after = False
        else:
            in_comment_block_after = in_comment_block
            comment_end = 0

        # Track :root block for styles.css
        if skip_root_block:
            if ':root' in line and '{' in line:
                in_root_block = True
                root_brace_depth = 1
            elif in_root_block:
                root_brace_depth += line.count('{') - line.count('}')
                if root_brace_depth <= 0:
                    in_root_block = False

            if in_root_block:
                new_lines.append(line)
                if '*/' in line:
                    in_comment_block = in_comment_block_after
                continue

        # Skip lines after a certain line (for corrupted sections)
        if skip_after_line and line_num > skip_after_line:
            new_lines.append(line)
            continue

        # Check if entire line is a comment
        stripped = line.strip()
        if stripped.startswith('/*') and stripped.endswith('*/'):
            new_lines.append(line)
            if '*/' in line:
                in_comment_block = in_comment_block_after if '*/' in line else in_comment_block
            continue
        if stripped.startswith('*') or stripped.startswith('//'):
            new_lines.append(line)
            continue
        if in_comment_block and '*/' not in line:
            new_lines.append(line)
            continue

        # Skip lines with url() or content: strings
        if is_in_url_or_content(line):
            new_lines.append(line)
            if '*/' in line:
                in_comment_block = False
            continue

        # Now process replacements
        new_line = line
        for hex_val, css_var in COLOR_MAP.items():
            # Case insensitive search
            hex_lower = hex_val.lower()

            # Find all occurrences
            temp_line = new_line
            result = ''
            while True:
                idx = temp_line.lower().find(hex_lower)
                if idx == -1:
                    result += temp_line
                    break

                # Check if this occurrence should be replaced
                # Check what follows the hex value
                after = temp_line[idx + len(hex_val):]

                # Skip if followed by digits + % (gradient stop)
                if re.match(r'\s+\d+%', after) or re.match(r'\d+%', after):
                    result += temp_line[:idx + len(hex_val)]
                    temp_line = after
                    continue

                # Check if we're inside a gradient function
                before = result + temp_line[:idx]
                in_gradient = False
                # Simple heuristic: check if 'gradient(' appears before and isn't closed
                open_parens = 0
                gradient_found = False
                for ch_idx, ch in enumerate(before):
                    if ch == '(':
                        open_parens += 1
                        # Check if this is a gradient function
                        func_text = before[max(0, ch_idx-20):ch_idx].lower()
                        if 'gradient' in func_text:
                            gradient_found = True
                    elif ch == ')':
                        open_parens -= 1
                        if open_parens <= 0:
                            gradient_found = False
                            open_parens = 0

                if gradient_found and open_parens > 0:
                    result += temp_line[:idx + len(hex_val)]
                    temp_line = after
                    continue

                # Safe to replace
                result += temp_line[:idx] + css_var
                temp_line = after
                changes += 1

            new_line = result

        new_lines.append(new_line)
        if '*/' in line:
            in_comment_block = False

    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    return changes

def main():
    base_dir = '/home/user/EventCall/styles'

    files_to_process = [
        ('login.css', False, None),
        ('admin-dashboard.css', False, None),
        ('dashboard-v2.css', False, None),
        ('feedback.css', False, None),
        ('components.css', False, None),
        ('invite.css', False, None),
        ('seating-chart.css', False, None),
        ('profile-completion.css', False, None),
        ('redesign.css', False, None),
        ('styles.css', True, None),  # skip_root_block=True
        ('event-management-v2.css', False, 1306),  # skip after line 1306
        ('form-validation.css', False, None),
        ('accessibility.css', False, None),
        ('responsive.css', False, None),
        ('side-by-side.css', False, None),
        ('app-loader.css', False, None),
        ('invite-envelope.css', False, None),
    ]

    total_changes = 0
    for filename, skip_root, skip_after in files_to_process:
        filepath = os.path.join(base_dir, filename)
        if not os.path.exists(filepath):
            print(f"SKIP {filename}: file not found")
            continue
        changes = process_file(filepath, skip_root_block=skip_root, skip_after_line=skip_after)
        print(f"{filename}: {changes} replacements")
        total_changes += changes

    print(f"\nTotal: {total_changes} replacements across all files")

if __name__ == '__main__':
    main()
